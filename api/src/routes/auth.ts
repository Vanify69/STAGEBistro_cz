import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import {
  getSessionUser,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  destroySession,
  SESSION_COOKIE,
} from '../lib/session.js';
import { getCookie } from 'hono/cookie';
import { resolveEffectivePermissions } from '../lib/permissions.js';
import { writeAudit, AUDIT_ACTIONS } from '../lib/auditLog.js';

export const authRouter = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function serializeAuthUser(user: {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'provoz' | 'ucetni';
  permissions: string[];
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    permissions: user.permissions,
  };
}

authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid body' }, 400);
  }
  const { email, password } = parsed.data;
  const db = getDb();
  const emailNorm = email.trim().toLowerCase();
  const found = await db.select().from(users).where(eq(users.email, emailNorm)).limit(1);
  const user = found[0];
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  const { sessionId, expiresAt } = await createSession(user.id);
  setSessionCookie(c, sessionId, expiresAt);
  const permissions = resolveEffectivePermissions(user.role, user.permissions);
  const authUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    permissions,
  };
  await writeAudit({
    user: authUser,
    action: AUDIT_ACTIONS.auth.login,
    summary: `Přihlášení: ${user.email}`,
  });
  return c.json({ user: serializeAuthUser(authUser) });
});

authRouter.post('/logout', async (c) => {
  const user = await getSessionUser(c);
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) {
    await destroySession(sid).catch(() => undefined);
  }
  clearSessionCookie(c);
  if (user) {
    await writeAudit({
      user,
      action: AUDIT_ACTIONS.auth.logout,
      summary: `Odhlášení: ${user.email}`,
    });
  }
  return c.json({ ok: true });
});

authRouter.get('/me', async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ user: null });
  }
  return c.json({ user: serializeAuthUser(user) });
});
