import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { dailySales, expenseReceipts } from '../db/schema.js';
import type { AuthUser } from '../lib/session.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { isValidYmd } from '../lib/pragueDate.js';
import { isR2Configured, presignPutObject } from '../lib/s3.js';

export const provozRouter = new Hono<{ Variables: { user: AuthUser } }>();

provozRouter.use('*', requireAuth);
provozRouter.use('*', requireRole('admin', 'provoz'));

const dailySchema = z.object({
  cashCents: z.number().int().min(0),
  cardCents: z.number().int().min(0),
  depositCents: z.number().int().min(0),
  bankCents: z.number().int().min(0),
  staffCents: z.number().int().min(0),
  notes: z.string().nullable().optional(),
});

provozRouter.get('/daily/:date', async (c) => {
  const date = c.req.param('date');
  if (!isValidYmd(date)) return c.json({ error: 'Invalid date' }, 400);
  const db = getDb();
  const rows = await db.select().from(dailySales).where(eq(dailySales.businessDate, date)).limit(1);
  return c.json({ daily: rows[0] ?? null });
});

provozRouter.put('/daily/:date', async (c) => {
  const date = c.req.param('date');
  if (!isValidYmd(date)) return c.json({ error: 'Invalid date' }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = dailySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const user = c.get('user');
  const db = getDb();
  const [row] = await db
    .insert(dailySales)
    .values({
      businessDate: date,
      cashCents: parsed.data.cashCents,
      cardCents: parsed.data.cardCents,
      depositCents: parsed.data.depositCents,
      bankCents: parsed.data.bankCents,
      staffCents: parsed.data.staffCents,
      notes: parsed.data.notes ?? null,
      createdBy: user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [dailySales.businessDate],
      set: {
        cashCents: parsed.data.cashCents,
        cardCents: parsed.data.cardCents,
        depositCents: parsed.data.depositCents,
        bankCents: parsed.data.bankCents,
        staffCents: parsed.data.staffCents,
        notes: parsed.data.notes ?? null,
        createdBy: user.id,
        updatedAt: new Date(),
      },
    })
    .returning();
  return c.json({ daily: row });
});

provozRouter.get('/month/:year/:month', async (c) => {
  const year = Number(c.req.param('year'));
  const month = Number(c.req.param('month'));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return c.json({ error: 'Invalid month' }, 400);
  }
  const start = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`;
  const last = new Date(year, month, 0).getDate();
  const end = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${last.toString().padStart(2, '0')}`;
  const db = getDb();
  const rows = await db
    .select()
    .from(dailySales)
    .where(and(gte(dailySales.businessDate, start), lte(dailySales.businessDate, end)))
    .orderBy(asc(dailySales.businessDate));
  return c.json({ dailies: rows });
});

const receiptCreateSchema = z.object({
  category: z.enum(['nafta', 'suroviny', 'ostatni']),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  amountCents: z.number().int().nullable().optional(),
  vatRate: z.number().int().nullable().optional(),
  note: z.string().nullable().optional(),
});

provozRouter.post('/receipts', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = receiptCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const user = c.get('user');
  const db = getDb();
  const [row] = await db
    .insert(expenseReceipts)
    .values({
      businessDate: parsed.data.businessDate ?? null,
      category: parsed.data.category,
      amountCents: parsed.data.amountCents ?? null,
      vatRate: parsed.data.vatRate ?? null,
      note: parsed.data.note ?? null,
      uploadedBy: user.id,
    })
    .returning();
  return c.json({ receipt: row }, 201);
});

const presignSchema = z.object({
  mime: z.string().min(3),
});

provozRouter.post('/receipts/:id/presign', async (c) => {
  if (!isR2Configured()) {
    return c.json({ error: 'File upload is not configured (R2)' }, 503);
  }
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const mime = parsed.data.mime;
  if (!mime.startsWith('image/') && mime !== 'application/pdf') {
    return c.json({ error: 'Unsupported mime type' }, 400);
  }
  const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
  const storageKey = `stagebistro/receipts/${id}/${crypto.randomUUID()}.${ext}`;
  const uploadUrl = await presignPutObject(storageKey, mime);
  return c.json({ uploadUrl, storageKey, mime });
});

const receiptCompleteSchema = z.object({
  storageKey: z.string().min(1),
  mime: z.string().min(1),
});

provozRouter.patch('/receipts/:id/complete', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = receiptCompleteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  if (!parsed.data.storageKey.startsWith(`stagebistro/receipts/${id}/`)) {
    return c.json({ error: 'Invalid storage key' }, 400);
  }
  const db = getDb();
  const [row] = await db
    .update(expenseReceipts)
    .set({ storageKey: parsed.data.storageKey, mime: parsed.data.mime })
    .where(eq(expenseReceipts.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ receipt: row });
});

provozRouter.get('/receipts', async (c) => {
  const db = getDb();
  const rows = await db.select().from(expenseReceipts).orderBy(asc(expenseReceipts.createdAt)).limit(200);
  return c.json({ receipts: rows });
});
