import { Hono } from 'hono';
import { and, asc, desc, eq, gte, isNotNull, isNull, lte } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { expenseReceipts, wagePayments, workers } from '../db/schema.js';
import type { AuthUser } from '../lib/session.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { mimeForContractKey } from '../lib/contractFile.js';
import { asciiFilename } from '../lib/pdf/pdfText.js';
import { getStorageBuffer } from '../lib/storage.js';
import { presignGetObject } from '../lib/s3.js';

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

ucetniRouter.get('/contracts', async (c) => {
  const pendingOnly = c.req.query('pending') !== 'false';
  const db = getDb();
  const conditions = [
    eq(workers.status, 'active'),
    isNotNull(workers.contractSignedAt),
    isNotNull(workers.contractPdfKey),
    isNull(workers.deletedAt),
  ];
  if (pendingOnly) {
    conditions.push(isNull(workers.contractAccountingSeenAt));
  }
  const rows = await db
    .select()
    .from(workers)
    .where(and(...conditions))
    .orderBy(desc(workers.contractSignedAt))
    .limit(200);

  return c.json({
    contracts: rows.map((w) => ({
      workerId: w.id,
      firstName: w.firstName,
      lastName: w.lastName,
      position: w.position,
      contractSource: w.contractSource,
      contractSignedAt: w.contractSignedAt,
      contractAccountingSeenAt: w.contractAccountingSeenAt,
      contractAccountingEmailedAt: w.contractAccountingEmailedAt,
      contractStart: w.contractStart,
      contractEnd: w.contractEnd,
      hourlyRateCents: w.hourlyRateCents,
    })),
  });
});

ucetniRouter.get('/contracts/:workerId/file', async (c) => {
  const workerId = c.req.param('workerId');
  const db = getDb();
  const [worker] = await db.select().from(workers).where(eq(workers.id, workerId)).limit(1);
  if (!worker?.contractPdfKey) return c.json({ error: 'Not found' }, 404);

  const buf = await getStorageBuffer(worker.contractPdfKey);
  if (!buf) return c.json({ error: 'Soubor smlouvy nenalezen' }, 404);

  const mime = mimeForContractKey(worker.contractPdfKey);
  return new Response(Buffer.from(buf), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `inline; filename="smlouva-dpc-${asciiFilename(worker.lastName)}.${worker.contractPdfKey.split('.').pop()}"`,
    },
  });
});

ucetniRouter.patch('/contracts/:workerId/seen', async (c) => {
  const workerId = c.req.param('workerId');
  const db = getDb();
  const [row] = await db
    .update(workers)
    .set({ contractAccountingSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(workers.id, workerId))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

ucetniRouter.get('/wage-payments', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  const workerId = c.req.query('workerId');
  const db = getDb();
  const rows = await db
    .select({
      payment: wagePayments,
      worker: workers,
    })
    .from(wagePayments)
    .innerJoin(workers, eq(wagePayments.workerId, workers.id))
    .orderBy(asc(wagePayments.paidAt))
    .limit(500);

  const filtered = rows.filter((r) => {
    if (workerId && r.worker.id !== workerId) return false;
    const d = r.payment.paidAt.toISOString().slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  return c.json({
    payments: filtered.map((r) => ({
      id: r.payment.id,
      vppNumber: r.payment.vppNumber,
      paidAt: r.payment.paidAt,
      amountCents: r.payment.amountCents,
      workedMinutesTotal: r.payment.workedMinutesTotal,
      reason: r.payment.reason,
      workerName: `${r.worker.firstName} ${r.worker.lastName}`,
      pdfStorageKey: r.payment.pdfStorageKey,
    })),
  });
});

ucetniRouter.get('/wage-payments/:id/pdf-url', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [row] = await db.select().from(wagePayments).where(eq(wagePayments.id, id)).limit(1);
  if (!row?.pdfStorageKey) return c.json({ error: 'PDF not found' }, 404);
  try {
    const url = await presignGetObject(row.pdfStorageKey);
    return c.json({ url });
  } catch {
    return c.json({ error: 'Storage not configured' }, 503);
  }
});

ucetniRouter.get('/export/wage-payments.csv', async (c) => {
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  const db = getDb();
  const rows = await db
    .select({ payment: wagePayments, worker: workers })
    .from(wagePayments)
    .innerJoin(workers, eq(wagePayments.workerId, workers.id))
    .orderBy(asc(wagePayments.paidAt));

  const filtered = rows.filter((r) => {
    const d = r.payment.paidAt.toISOString().slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const header = 'vpp_number;datum;jmeno;castka_kc;hodiny;duvod\n';
  const lines = filtered.map((r) => {
    const date = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague' }).format(r.payment.paidAt);
    const kc = (r.payment.amountCents / 100).toFixed(2).replace('.', ',');
    const hours = (r.payment.workedMinutesTotal / 60).toFixed(2).replace('.', ',');
    const name = `${r.worker.firstName} ${r.worker.lastName}`.replace(/;/g, ' ');
    return `${r.payment.vppNumber};${date};${name};${kc};${hours};${r.payment.reason}`;
  });
  const csv = '\uFEFF' + header + lines.join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="vpp-export.csv"',
    },
  });
});
