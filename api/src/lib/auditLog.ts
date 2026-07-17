import { desc } from 'drizzle-orm';
import type { Context } from 'hono';
import { getDb } from '../db/index.js';
import { auditLog } from '../db/schema.js';
import type { AuthUser } from './session.js';

export type AuditInput = {
  user?: AuthUser | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

export async function writeAudit(entry: AuditInput): Promise<void> {
  const db = getDb();
  await db.insert(auditLog).values({
    userId: entry.user?.id ?? null,
    userEmail: entry.user?.email ?? 'system',
    userDisplayName: entry.user?.displayName ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
  });
}

/** Zkratka pro audit z Hono handleru s přihlášeným uživatelem. */
export async function auditAction(
  c: Context<{ Variables: { user: AuthUser } }>,
  entry: Omit<AuditInput, 'user'>
): Promise<void> {
  await writeAudit({ ...entry, user: c.get('user') });
}

export const AUDIT_ACTIONS = {
  auth: { login: 'auth.login', logout: 'auth.logout' },
  site: {
    settings: 'site.settings.update',
    menuCategoryCreate: 'site.menu.category.create',
    menuCategoryUpdate: 'site.menu.category.update',
    menuCategoryDelete: 'site.menu.category.delete',
    menuItemCreate: 'site.menu.item.create',
    menuItemUpdate: 'site.menu.item.update',
    menuItemDelete: 'site.menu.item.delete',
    galleryCreate: 'site.gallery.create',
    galleryUpdate: 'site.gallery.update',
    galleryDelete: 'site.gallery.delete',
    eventCreate: 'site.event.create',
    eventUpdate: 'site.event.update',
    eventDelete: 'site.event.delete',
  },
  user: { create: 'user.create', update: 'user.update' },
  provoz: {
    salesUpdate: 'provoz.sales.update',
    receiptCreate: 'provoz.receipt.create',
    receiptUpload: 'provoz.receipt.upload',
  },
  staff: {
    workerCreate: 'staff.worker.create',
    workerUpdate: 'staff.worker.update',
    workerDelete: 'staff.worker.delete',
    workerRestore: 'staff.worker.restore',
    contractGenerate: 'staff.contract.generate',
    contractSign: 'staff.contract.sign',
    contractScan: 'staff.contract.scan',
    shiftCreate: 'staff.shift.create',
    shiftUpdate: 'staff.shift.update',
    shiftDelete: 'staff.shift.delete',
    attendanceUpdate: 'staff.attendance.update',
    attendanceConfirm: 'staff.attendance.confirm',
    paymentCreate: 'staff.payment.create',
  },
  accounting: {
    receiptBook: 'accounting.receipt.book',
    contractSeen: 'accounting.contract.seen',
  },
} as const;

export async function listAuditLog(opts: {
  limit?: number;
  userId?: string;
  action?: string;
}) {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 100, 500);
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
  return rows.filter((row) => {
    if (opts.userId && row.userId !== opts.userId) return false;
    if (opts.action && row.action !== opts.action) return false;
    return true;
  });
}
