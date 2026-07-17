import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { asc, eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthUser } from '../lib/session.js';
import { requirePermission } from '../middleware/auth.js';
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_PRESETS,
  ROLE_PERMISSION_TEMPLATES,
  parseStoredPermissions,
  resolveEffectivePermissions,
  type Permission,
} from '../lib/permissions.js';
import { listAuditLog, writeAudit, AUDIT_ACTIONS } from '../lib/auditLog.js';

const roleSchema = z.enum(['admin', 'provoz', 'ucetni']);
const permissionSchema = z.enum(PERMISSIONS);

function serializeAdminUser(row: typeof users.$inferSelect) {
  const explicit = parseStoredPermissions(row.permissions);
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt,
    permissions: explicit,
    effectivePermissions: resolveEffectivePermissions(row.role, row.permissions),
    createdAt: row.createdAt,
  };
}

async function countActiveAdmins(excludeId?: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: users.id, role: users.role, isActive: users.isActive })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));
  return rows.filter((r) => r.id !== excludeId).length;
}

export const adminUsersRouter = new Hono<{ Variables: { user: AuthUser } }>();

adminUsersRouter.get('/permissions', requirePermission('users.manage'), async (c) => {
  return c.json({
    permissions: PERMISSIONS.map((p) => ({ id: p, label: PERMISSION_LABELS[p] })),
    roleTemplates: ROLE_PERMISSION_TEMPLATES,
    presets: PERMISSION_PRESETS,
  });
});

adminUsersRouter.get('/users', requirePermission('users.manage'), async (c) => {
  const db = getDb();
  const rows = await db.select().from(users).orderBy(asc(users.email));
  return c.json({ users: rows.map(serializeAdminUser) });
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().max(120).nullable().optional(),
  role: roleSchema,
  permissions: z.array(permissionSchema).nullable().optional(),
  isActive: z.boolean().optional(),
});

adminUsersRouter.post('/users', requirePermission('users.manage'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);

  const actor = c.get('user');
  const emailNorm = parsed.data.email.trim().toLowerCase();
  const db = getDb();
  const existing = await db.select().from(users).where(eq(users.email, emailNorm)).limit(1);
  if (existing[0]) return c.json({ error: 'E-mail je již použit' }, 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const permissionsJson =
    parsed.data.permissions != null ? JSON.stringify(parsed.data.permissions) : null;

  const [row] = await db
    .insert(users)
    .values({
      email: emailNorm,
      passwordHash,
      displayName: parsed.data.displayName ?? null,
      role: parsed.data.role,
      permissions: permissionsJson,
      isActive: parsed.data.isActive ?? true,
    })
    .returning();

  await writeAudit({
    user: actor,
    action: AUDIT_ACTIONS.user.create,
    entityType: 'user',
    entityId: row!.id,
    summary: `Vytvořen uživatel ${emailNorm} (${parsed.data.role})`,
    metadata: { role: parsed.data.role, permissions: parsed.data.permissions },
  });

  return c.json({ user: serializeAdminUser(row!) }, 201);
});

const patchUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  displayName: z.string().max(120).nullable().optional(),
  role: roleSchema.optional(),
  permissions: z.array(permissionSchema).nullable().optional(),
  isActive: z.boolean().optional(),
});

adminUsersRouter.patch('/users/:id', requirePermission('users.manage'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);

  const actor = c.get('user');
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const nextRole = parsed.data.role ?? existing.role;
  const nextActive = parsed.data.isActive ?? existing.isActive;

  if (existing.role === 'admin' && (!nextActive || nextRole !== 'admin')) {
    const others = await countActiveAdmins(id);
    if (others === 0) {
      return c.json({ error: 'Nelze deaktivovat nebo změnit roli posledního aktivního admina' }, 400);
    }
  }

  if (id === actor.id && parsed.data.isActive === false) {
    return c.json({ error: 'Nelze deaktivovat vlastní účet' }, 400);
  }

  const patch: Partial<typeof users.$inferInsert> = {};
  if (parsed.data.email) patch.email = parsed.data.email.trim().toLowerCase();
  if (parsed.data.displayName !== undefined) patch.displayName = parsed.data.displayName;
  if (parsed.data.role) patch.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) patch.isActive = parsed.data.isActive;
  if (parsed.data.permissions !== undefined) {
    patch.permissions =
      parsed.data.permissions != null ? JSON.stringify(parsed.data.permissions) : null;
  }
  if (parsed.data.password) {
    patch.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
  if (!row) return c.json({ error: 'Not found' }, 404);

  await writeAudit({
    user: actor,
    action: AUDIT_ACTIONS.user.update,
    entityType: 'user',
    entityId: id,
    summary: `Upraven uživatel ${row.email}`,
    metadata: {
      role: parsed.data.role,
      isActive: parsed.data.isActive,
      permissions: parsed.data.permissions,
      passwordChanged: Boolean(parsed.data.password),
    },
  });

  return c.json({ user: serializeAdminUser(row) });
});

adminUsersRouter.get('/audit-log', requirePermission('audit.read'), async (c) => {
  const userId = c.req.query('userId') ?? undefined;
  const action = c.req.query('action') ?? undefined;
  const limit = Number(c.req.query('limit') ?? '100');
  const rows = await listAuditLog({ userId, action, limit });
  return c.json({
    entries: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userEmail: r.userEmail,
      userDisplayName: r.userDisplayName,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      summary: r.summary,
      metadata: r.metadata ? (JSON.parse(r.metadata) as unknown) : null,
      createdAt: r.createdAt,
    })),
  });
});
