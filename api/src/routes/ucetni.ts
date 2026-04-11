import { Hono } from 'hono';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { expenseReceipts } from '../db/schema.js';
import type { AuthUser } from '../lib/session.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const ucetniRouter = new Hono<{ Variables: { user: AuthUser } }>();

ucetniRouter.use('*', requireAuth);
ucetniRouter.use('*', requireRole('admin', 'ucetni'));

ucetniRouter.get('/receipts', async (c) => {
  const status = c.req.query('status');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const db = getDb();
  const conditions = [];
  if (status === 'pending' || status === 'booked') {
    conditions.push(eq(expenseReceipts.status, status));
  }
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    conditions.push(gte(expenseReceipts.createdAt, new Date(`${from}T00:00:00.000Z`)));
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    conditions.push(lte(expenseReceipts.createdAt, new Date(`${to}T23:59:59.999Z`)));
  }
  const whereClause = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(expenseReceipts)
    .where(whereClause)
    .orderBy(asc(expenseReceipts.createdAt))
    .limit(500);
  return c.json({ receipts: rows });
});

ucetniRouter.patch('/receipts/:id/book', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const db = getDb();
  const [row] = await db
    .update(expenseReceipts)
    .set({
      status: 'booked',
      bookedAt: new Date(),
      bookedBy: user.id,
    })
    .where(eq(expenseReceipts.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ receipt: row });
});
