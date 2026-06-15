import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  attendanceRecords,
  shiftAssignments,
  wagePaymentLines,
  wagePayments,
  workers,
} from '../db/schema.js';
import type { AuthUser } from '../lib/session.js';
import { isValidYmd } from '../lib/pragueDate.js';
import { isR2Configured, presignPutObject } from '../lib/s3.js';
import { parseDataUrl, publicUrlForKey, putStorageBuffer } from '../lib/storage.js';
import { getEmployerSettings } from '../lib/employerSettings.js';
import { buildContractDpcPdf, buildContractDpcPdfForWorker } from '../lib/pdf/contractDpc.js';
import { asciiFilename } from '../lib/pdf/pdfText.js';
import { buildVppPdf } from '../lib/pdf/vpp.js';
import {
  assertWorkerCanSchedule,
  buildLimitCheck,
  getWorkerStats,
  listUnpaidAttendance,
} from '../lib/dpcLimits.js';
import { VPP_REASON_DEFAULT } from '../lib/dpcConstants.js';
import { nextVppNumber } from '../lib/vppSequence.js';
import {
  computeWorkedMinutes,
  formatTimeHm,
  minutesToAmountCents,
} from '../lib/workedMinutes.js';
import { buildMonthCalendar } from '../lib/staffCalendar.js';
import {
  contractFileResponseHeaders,
  persistWorkerContractPdf,
  resolveWorkerContractFile,
  workerHasStoredSignature,
  canSafelyRegenerateContract,
} from '../lib/contractStorage.js';
import { CONTRACT_SCAN_MIMES, extForContractMime } from '../lib/contractFile.js';
import { notifyAccountingOfContract } from '../lib/contractAccountingNotify.js';
import { confirmPlannedAttendance, listUnconfirmedShifts } from '../lib/attendanceConfirm.js';
import {
  assertAttendanceEditable,
  formatTimestampHmPrague,
  updateAttendanceTimes,
  updateShiftTimesAndSyncAttendance,
} from '../lib/attendanceUpdate.js';

export const provozStaffRouter = new Hono<{ Variables: { user: AuthUser } }>();

const hmRegex = /^([01]?\d|2[0-3]):[0-5]\d$/;

function toPgTime(hm: string): string {
  return hm.length === 5 ? `${hm}:00` : hm;
}

const workerCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  bankAccountNumber: z.string().max(34).nullable().optional(),
  maidenName: z.string().max(120).nullable().optional(),
  healthInsurance: z.string().max(120).nullable().optional(),
  position: z.string().min(1).default('Barista'),
  workPlace: z.string().min(1).optional(),
  hourlyRateCents: z.number().int().min(0),
  contractStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  contractEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const workerPatchSchema = workerCreateSchema.partial();

const shiftSchema = z.object({
  workerId: z.string().uuid(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  plannedStart: z.string().regex(hmRegex),
  plannedEnd: z.string().regex(hmRegex),
  note: z.string().nullable().optional(),
});

function serializeWorker(
  w: typeof workers.$inferSelect,
  extras?: { contractHasWorkerSignature?: boolean }
) {
  return {
    id: w.id,
    firstName: w.firstName,
    lastName: w.lastName,
    birthDate: w.birthDate,
    address: w.address,
    phone: w.phone,
    bankAccountNumber: w.bankAccountNumber,
    maidenName: w.maidenName,
    healthInsurance: w.healthInsurance,
    position: w.position,
    workPlace: w.workPlace,
    hourlyRateCents: w.hourlyRateCents,
    contractStart: w.contractStart,
    contractEnd: w.contractEnd,
    status: w.status,
    contractPdfKey: w.contractPdfKey,
    contractSource: w.contractSource,
    contractPdfUrl: publicUrlForKey(w.contractPdfKey),
    contractDownloadPath: w.contractPdfKey ? `/api/provoz/workers/${w.id}/contract/pdf` : null,
    contractFilePath: w.contractPdfKey ? `/api/provoz/workers/${w.id}/contract/file` : null,
    contractSignedAt: w.contractSignedAt,
    contractHasWorkerSignature: extras?.contractHasWorkerSignature,
    contractAccountingSeenAt: w.contractAccountingSeenAt,
    contractAccountingEmailedAt: w.contractAccountingEmailedAt,
    deletedAt: w.deletedAt,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

async function serializeWorkerDetail(w: typeof workers.$inferSelect) {
  const contractHasWorkerSignature = await workerHasStoredSignature(w);
  return serializeWorker(w, { contractHasWorkerSignature });
}

async function maybeRefreshGeneratedContractPdf(
  worker: typeof workers.$inferSelect
): Promise<typeof workers.$inferSelect> {
  if (worker.status !== 'active' || worker.contractSource !== 'generated') return worker;
  if (!(await canSafelyRegenerateContract(worker))) return worker;
  try {
    const { key } = await persistWorkerContractPdf(worker);
    if (key === worker.contractPdfKey) return worker;
    const db = getDb();
    const [row] = await db
      .update(workers)
      .set({ contractPdfKey: key, updatedAt: new Date() })
      .where(eq(workers.id, worker.id))
      .returning();
    return row ?? worker;
  } catch (err) {
    console.error('[contract/refresh-pdf]', err);
    return worker;
  }
}

provozStaffRouter.get('/workers', async (c) => {
  const deleted = c.req.query('deleted') === 'true';
  const db = getDb();
  const rows = await db
    .select()
    .from(workers)
    .where(deleted ? isNotNull(workers.deletedAt) : isNull(workers.deletedAt))
    .orderBy(asc(workers.lastName), asc(workers.firstName));
  return c.json({ workers: rows.map((w) => serializeWorker(w)) });
});

provozStaffRouter.post('/workers', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = workerCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const employer = await getEmployerSettings();
  const db = getDb();
  const [row] = await db
    .insert(workers)
    .values({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      birthDate: parsed.data.birthDate ?? null,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      bankAccountNumber: parsed.data.bankAccountNumber ?? null,
      maidenName: parsed.data.maidenName ?? null,
      healthInsurance: parsed.data.healthInsurance ?? null,
      position: parsed.data.position,
      workPlace: parsed.data.workPlace ?? employer.defaultWorkPlace,
      hourlyRateCents: parsed.data.hourlyRateCents,
      contractStart: parsed.data.contractStart ?? null,
      contractEnd: parsed.data.contractEnd ?? null,
      status: 'draft',
    })
    .returning();
  return c.json({ worker: serializeWorker(row!) }, 201);
});

provozStaffRouter.get('/workers/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [row] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ worker: await serializeWorkerDetail(row) });
});

provozStaffRouter.patch('/workers/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = workerPatchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [row] = await db
    .update(workers)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(workers.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  const refreshed = await maybeRefreshGeneratedContractPdf(row);
  return c.json({ worker: await serializeWorkerDetail(refreshed) });
});

provozStaffRouter.delete('/workers/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [row] = await db
    .update(workers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(workers.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ worker: serializeWorker(row) });
});

provozStaffRouter.post('/workers/:id/restore', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [row] = await db
    .update(workers)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(workers.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ worker: serializeWorker(row) });
});

provozStaffRouter.get('/workers/:id/stats', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [row] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!row) return c.json({ error: 'Not found' }, 404);
  const stats = await getWorkerStats(id);
  return c.json({ stats });
});

provozStaffRouter.post('/workers/:id/contract/generate', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!worker) return c.json({ error: 'Not found' }, 404);
  try {
    const employer = await getEmployerSettings();
    const pdf = await buildContractDpcPdf(worker, employer);
    const key = `stagebistro/workers/${id}/contract/${crypto.randomUUID()}.pdf`;
    await putStorageBuffer(key, pdf, 'application/pdf');
    const [row] = await db
      .update(workers)
      .set({ contractPdfKey: key, status: 'contract_pending', updatedAt: new Date() })
      .where(eq(workers.id, id))
      .returning();
    return c.json({ worker: serializeWorker(row!) });
  } catch (err) {
    console.error('[contract/generate]', err);
    return c.json({ error: err instanceof Error ? err.message : 'Generovani smlouvy selhalo' }, 500);
  }
});

provozStaffRouter.get('/workers/:id/contract/file', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!worker) return c.json({ error: 'Not found' }, 404);

  const result = await resolveWorkerContractFile(worker);
  if (!result.ok) return c.json({ error: result.error }, result.status);

  if (result.newPdfKey) {
    await db
      .update(workers)
      .set({ contractPdfKey: result.newPdfKey, updatedAt: new Date() })
      .where(eq(workers.id, id));
  }

  return new Response(Buffer.from(result.buf), {
    headers: contractFileResponseHeaders(worker, result),
  });
});

provozStaffRouter.post('/workers/:id/contract/upload-scan', async (c) => {
  const id = c.req.param('id');
  const mime = (c.req.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  if (!(CONTRACT_SCAN_MIMES as readonly string[]).includes(mime)) {
    return c.json({ error: 'Povolené formáty: PDF, JPEG, PNG' }, 400);
  }
  const ext = extForContractMime(mime);
  if (!ext) return c.json({ error: 'Nepodporovaný typ souboru' }, 400);

  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length === 0) return c.json({ error: 'Prázdný soubor' }, 400);
  if (bytes.length > 15 * 1024 * 1024) return c.json({ error: 'Soubor je příliš velký (max 15 MB)' }, 400);

  const db = getDb();
  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!worker || worker.deletedAt) return c.json({ error: 'Not found' }, 404);
  if (worker.status === 'active') {
    return c.json({ error: 'Zaměstnanec je již aktivní — smlouvu nelze nahrát znovu' }, 400);
  }

  const key = `stagebistro/workers/${id}/contract/scan-${crypto.randomUUID()}.${ext}`;
  await putStorageBuffer(key, bytes, mime);
  const signedAt = new Date();

  const [row] = await db
    .update(workers)
    .set({
      contractPdfKey: key,
      contractSource: 'scan',
      contractSignedAt: signedAt,
      contractAccountingSeenAt: null,
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(workers.id, id))
    .returning();

  const mail = await notifyAccountingOfContract(row!);
  return c.json({ worker: serializeWorker(row!), accountingQueued: true, accountingEmailed: mail.emailed });
});

provozStaffRouter.get('/workers/:id/contract/pdf', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!worker) return c.json({ error: 'Not found' }, 404);

  try {
    const pdf = await buildContractDpcPdfForWorker(worker);
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="smlouva-dpc-${asciiFilename(worker.lastName)}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[contract/pdf]', err);
    return c.json({ error: err instanceof Error ? err.message : 'PDF nelze vytvorit' }, 500);
  }
});

const signCompleteSchema = z.object({
  storageKey: z.string().min(1).optional(),
  signatureDataUrl: z.string().min(1).optional(),
}).refine((d) => d.storageKey || d.signatureDataUrl, {
  message: 'storageKey nebo signatureDataUrl je povinne',
});

provozStaffRouter.post('/workers/:id/contract/presign-worker', async (c) => {
  if (!isR2Configured()) return c.json({ error: 'R2 not configured' }, 503);
  const id = c.req.param('id');
  const storageKey = `stagebistro/workers/${id}/signatures/worker-${crypto.randomUUID()}.png`;
  const uploadUrl = await presignPutObject(storageKey, 'image/png');
  return c.json({ uploadUrl, storageKey });
});

provozStaffRouter.post('/workers/:id/contract/sign-worker', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = signCompleteSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);

  const db = getDb();
  const [existing] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!existing || existing.deletedAt) return c.json({ error: 'Not found' }, 404);

  const isActiveResign = existing.status === 'active';
  if (isActiveResign) {
    if (existing.contractSource === 'scan') {
      return c.json({ error: 'U smlouvy ze skenu nelze doplnit digitální podpis' }, 400);
    }
    if (await workerHasStoredSignature(existing)) {
      return c.json({ error: 'Podpis zaměstnance je již uložen' }, 400);
    }
  } else if (existing.status !== 'draft' && existing.status !== 'contract_pending') {
    return c.json({ error: 'Podpis lze uložit jen u rozpracované nebo aktivní smlouvy bez podpisu' }, 400);
  }

  let signatureKey = parsed.data.storageKey;
  if (parsed.data.signatureDataUrl) {
    try {
      const { bytes } = parseDataUrl(parsed.data.signatureDataUrl);
      signatureKey = `stagebistro/workers/${id}/signatures/worker-${crypto.randomUUID()}.png`;
      await putStorageBuffer(signatureKey, bytes, 'image/png');
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Ulozeni podpisu selhalo' }, 400);
    }
  }
  if (!signatureKey?.startsWith(`stagebistro/workers/${id}/`)) {
    return c.json({ error: 'Invalid storage key' }, 400);
  }

  const signedAt = new Date();
  const [row] = await db
    .update(workers)
    .set({
      contractSignatureWorkerKey: signatureKey,
      contractSignedAt: existing.contractSignedAt ?? signedAt,
      contractSource: 'generated',
      contractAccountingSeenAt: isActiveResign ? existing.contractAccountingSeenAt : null,
      updatedAt: new Date(),
    })
    .where(eq(workers.id, id))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);

  try {
    const { key: pdfKey } = await persistWorkerContractPdf(row);
    const [finalWorker] = await db
      .update(workers)
      .set({
        contractPdfKey: pdfKey,
        ...(isActiveResign ? {} : { status: 'active' as const }),
        updatedAt: new Date(),
      })
      .where(eq(workers.id, id))
      .returning();
    const worker = finalWorker ?? row;
    const mail = isActiveResign
      ? { emailed: false }
      : await notifyAccountingOfContract(worker);
    return c.json({
      worker: await serializeWorkerDetail(worker),
      accountingQueued: !isActiveResign,
      accountingEmailed: mail.emailed,
      signatureAttached: isActiveResign,
    });
  } catch (err) {
    console.error('[contract/sign-worker]', err);
    return c.json({ error: err instanceof Error ? err.message : 'PDF s podpisem se nepodarilo ulozit' }, 500);
  }
});

provozStaffRouter.get('/calendar/:year/:month', async (c) => {
  const year = Number(c.req.param('year'));
  const month = Number(c.req.param('month'));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return c.json({ error: 'Invalid month' }, 400);
  }
  const calendar = await buildMonthCalendar(year, month);
  return c.json({ calendar });
});

provozStaffRouter.get('/shifts', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!from || !to || !isValidYmd(from) || !isValidYmd(to)) {
    return c.json({ error: 'from and to required (YYYY-MM-DD)' }, 400);
  }
  const db = getDb();
  const rows = await db
    .select({
      shift: shiftAssignments,
      worker: workers,
      attendance: attendanceRecords,
    })
    .from(shiftAssignments)
    .innerJoin(workers, eq(shiftAssignments.workerId, workers.id))
    .leftJoin(attendanceRecords, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))
    .where(
      and(
        isNull(shiftAssignments.cancelledAt),
        isNull(workers.deletedAt)
      )
    )
    .orderBy(asc(shiftAssignments.businessDate));
  const filtered = rows.filter(
    (r) => r.shift.businessDate >= from && r.shift.businessDate <= to
  );
  return c.json({
    shifts: filtered.map((r) => ({
      id: r.shift.id,
      workerId: r.worker.id,
      workerName: `${r.worker.firstName} ${r.worker.lastName}`,
      businessDate: r.shift.businessDate,
      plannedStart: formatTimeHm(String(r.shift.plannedStart)),
      plannedEnd: formatTimeHm(String(r.shift.plannedEnd)),
      note: r.shift.note,
      attendanceStatus: r.attendance?.status ?? null,
    })),
  });
});

provozStaffRouter.post('/shifts', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = shiftSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [worker] = await db.select().from(workers).where(eq(workers.id, parsed.data.workerId)).limit(1);
  if (!worker || worker.deletedAt) return c.json({ error: 'Worker not found' }, 404);
  if (worker.status !== 'active') {
    return c.json({ error: 'Worker must be active (signed contract)' }, 400);
  }
  const year = Number(parsed.data.businessDate.slice(0, 4));
  try {
    await assertWorkerCanSchedule(worker.id, year);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
  try {
    const [shift] = await db
      .insert(shiftAssignments)
      .values({
        workerId: parsed.data.workerId,
        businessDate: parsed.data.businessDate,
        plannedStart: toPgTime(parsed.data.plannedStart),
        plannedEnd: toPgTime(parsed.data.plannedEnd),
        note: parsed.data.note ?? null,
      })
      .returning();
    await db.insert(attendanceRecords).values({ shiftAssignmentId: shift!.id });
    return c.json({ shift: { ...shift, plannedStart: formatTimeHm(String(shift!.plannedStart)), plannedEnd: formatTimeHm(String(shift!.plannedEnd)) } }, 201);
  } catch {
    return c.json({ error: 'Směna pro tento den již existuje' }, 409);
  }
});

const attendanceTimesSchema = z.object({
  actualStart: z.string().regex(hmRegex),
  actualEnd: z.string().regex(hmRegex),
});

provozStaffRouter.patch('/shifts/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = shiftSchema.partial().omit({ workerId: true }).safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);

  try {
    if (parsed.data.plannedStart && parsed.data.plannedEnd) {
      const shift = await updateShiftTimesAndSyncAttendance(
        id,
        parsed.data.plannedStart,
        parsed.data.plannedEnd,
        user.id
      );
      return c.json({
        shift: {
          ...shift,
          plannedStart: formatTimeHm(String(shift.plannedStart)),
          plannedEnd: formatTimeHm(String(shift.plannedEnd)),
        },
      });
    }

    const db = getDb();
    const [shift] = await db
      .update(shiftAssignments)
      .set({
        ...(parsed.data.plannedStart ? { plannedStart: toPgTime(parsed.data.plannedStart) } : {}),
        ...(parsed.data.plannedEnd ? { plannedEnd: toPgTime(parsed.data.plannedEnd) } : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {}),
        updatedAt: new Date(),
      })
      .where(eq(shiftAssignments.id, id))
      .returning();
    if (!shift) return c.json({ error: 'Not found' }, 404);
    return c.json({ shift });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Úprava směny selhala' }, 400);
  }
});

provozStaffRouter.patch('/attendance/:attendanceId', async (c) => {
  const attendanceId = c.req.param('attendanceId');
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = attendanceTimesSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);

  try {
    const attendance = await updateAttendanceTimes(
      attendanceId,
      parsed.data.actualStart,
      parsed.data.actualEnd,
      user.id
    );
    return c.json({ attendance });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Úprava docházky selhala' }, 400);
  }
});

provozStaffRouter.delete('/shifts/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const [row] = await db
    .select({ attendance: attendanceRecords })
    .from(shiftAssignments)
    .leftJoin(attendanceRecords, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))
    .where(eq(shiftAssignments.id, id))
    .limit(1);
  if (row?.attendance?.id) {
    try {
      await assertAttendanceEditable(row.attendance.id);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Směnu nelze zrušit' }, 400);
    }
  }
  const [shift] = await db
    .update(shiftAssignments)
    .set({ cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(shiftAssignments.id, id))
    .returning();
  if (!shift) return c.json({ error: 'Not found' }, 404);
  return c.json({ ok: true });
});

provozStaffRouter.get('/workers/:id/unconfirmed', async (c) => {
  const id = c.req.param('id');
  const items = await listUnconfirmedShifts(id);
  return c.json({ items });
});

provozStaffRouter.post('/workers/:id/shifts/:shiftId/confirm-attendance', async (c) => {
  const shiftId = c.req.param('shiftId');
  const workerId = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const startHm = (body as { actualStart?: string }).actualStart;
  const endHm = (body as { actualEnd?: string }).actualEnd;
  if (startHm && !hmRegex.test(startHm)) return c.json({ error: 'Neplatný čas příchodu' }, 400);
  if (endHm && !hmRegex.test(endHm)) return c.json({ error: 'Neplatný čas odchodu' }, 400);

  const db = getDb();
  const [shift] = await db
    .select()
    .from(shiftAssignments)
    .where(eq(shiftAssignments.id, shiftId))
    .limit(1);
  if (!shift || shift.workerId !== workerId || shift.cancelledAt) {
    return c.json({ error: 'Not found' }, 404);
  }
  try {
    const attendance = await confirmPlannedAttendance(
      shiftId,
      user.id,
      undefined,
      startHm,
      endHm
    );
    return c.json({ attendance });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Potvrzení selhalo' }, 400);
  }
});

provozStaffRouter.get('/workers/:id/unpaid', async (c) => {
  const id = c.req.param('id');
  const unpaid = await listUnpaidAttendance(id);
  return c.json({
    items: unpaid.map((r) => ({
      attendanceId: r.attendance.id,
      shiftId: r.shift.id,
      businessDate: r.shift.businessDate,
      workedMinutes: r.attendance.workedMinutes,
      plannedStart: formatTimeHm(String(r.shift.plannedStart)),
      plannedEnd: formatTimeHm(String(r.shift.plannedEnd)),
      actualStart: r.attendance.actualStart ? formatTimestampHmPrague(r.attendance.actualStart) : null,
      actualEnd: r.attendance.actualEnd ? formatTimestampHmPrague(r.attendance.actualEnd) : null,
    })),
  });
});

const paymentPreviewSchema = z.object({
  attendanceRecordIds: z.array(z.string().uuid()).min(1),
});

provozStaffRouter.post('/workers/:id/payments/preview', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = paymentPreviewSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);
  const db = getDb();
  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!worker) return c.json({ error: 'Not found' }, 404);

  const unpaid = await listUnpaidAttendance(id);
  const selected = unpaid.filter((u) => parsed.data.attendanceRecordIds.includes(u.attendance.id));
  if (selected.length !== parsed.data.attendanceRecordIds.length) {
    return c.json({ error: 'Invalid attendance records' }, 400);
  }
  const workedMinutesTotal = selected.reduce((s, r) => s + (r.attendance.workedMinutes ?? 0), 0);
  const amountCents = minutesToAmountCents(workedMinutesTotal, worker.hourlyRateCents);
  const limits = await buildLimitCheck(id, amountCents, new Date());
  return c.json({ workedMinutesTotal, amountCents, limits });
});

const paymentCreateSchema = paymentPreviewSchema.extend({
  confirmOverLimit: z.boolean().optional(),
  recipientSignatureKey: z.string().min(1),
  issuerSignatureKey: z.string().min(1),
  note: z.string().nullable().optional(),
});

provozStaffRouter.post('/workers/:id/payments', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');
  const body = await c.req.json().catch(() => null);
  const parsed = paymentCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);

  const db = getDb();
  const [worker] = await db.select().from(workers).where(eq(workers.id, id)).limit(1);
  if (!worker) return c.json({ error: 'Not found' }, 404);

  const unpaid = await listUnpaidAttendance(id);
  const unpaidIds = new Set(unpaid.map((u) => u.attendance.id));
  for (const aid of parsed.data.attendanceRecordIds) {
    if (!unpaidIds.has(aid)) return c.json({ error: 'Attendance already paid or not confirmed' }, 400);
  }

  const records = unpaid.filter((u) => parsed.data.attendanceRecordIds.includes(u.attendance.id));
  const workedMinutesTotal = records.reduce((s, r) => s + (r.attendance.workedMinutes ?? 0), 0);
  const amountCents = minutesToAmountCents(workedMinutesTotal, worker.hourlyRateCents);
  const limits = await buildLimitCheck(id, amountCents, new Date());

  if (limits.yearBlocked) {
    return c.json({ error: 'Roční limit 300 hodin byl dosažen' }, 400);
  }
  if (limits.monthWouldExceed && !parsed.data.confirmOverLimit) {
    return c.json({
      error: 'Měsíční limit 11 500 Kč by byl překročen',
      limits,
      requiresConfirm: true,
    }, 400);
  }

  const year = new Date().getFullYear();
  const vppNumber = await nextVppNumber(year);
  const paidAt = new Date();
  let note = parsed.data.note ?? null;
  if (limits.monthWouldExceed && parsed.data.confirmOverLimit) {
    note = [note, 'Potvrzeno překročení měsíčního limitu 11 500 Kč'].filter(Boolean).join('; ');
  }

  const [payment] = await db
    .insert(wagePayments)
    .values({
      workerId: id,
      vppNumber,
      paidAt,
      amountCents,
      hourlyRateCentsSnapshot: worker.hourlyRateCents,
      workedMinutesTotal,
      reason: VPP_REASON_DEFAULT,
      recipientSignatureKey: parsed.data.recipientSignatureKey,
      issuerSignatureKey: parsed.data.issuerSignatureKey,
      note,
      paidBy: user.id,
    })
    .returning();

  for (const r of records) {
    await db.insert(wagePaymentLines).values({
      wagePaymentId: payment!.id,
      attendanceRecordId: r.attendance.id,
    });
  }

  const pdfBytes = await buildVppPdf({
    vppNumber,
    paidAt,
    recipientName: `${worker.firstName} ${worker.lastName}`,
    amountCents,
    reason: VPP_REASON_DEFAULT,
    recipientSignatureKey: parsed.data.recipientSignatureKey,
    issuerSignatureKey: parsed.data.issuerSignatureKey,
  });
  const pdfKey = `stagebistro/vpp/${payment!.id}/${crypto.randomUUID()}.pdf`;
  await putStorageBuffer(pdfKey, pdfBytes, 'application/pdf');
  const [updated] = await db
    .update(wagePayments)
    .set({ pdfStorageKey: pdfKey })
    .where(eq(wagePayments.id, payment!.id))
    .returning();

  return c.json({
    payment: {
      ...updated,
      pdfUrl: publicUrlForKey(pdfKey),
    },
  }, 201);
});

provozStaffRouter.get('/workers/:id/payments', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const rows = await db
    .select()
    .from(wagePayments)
    .where(eq(wagePayments.workerId, id))
    .orderBy(asc(wagePayments.paidAt));
  return c.json({
    payments: rows.map((p) => ({
      ...p,
      pdfUrl: publicUrlForKey(p.pdfStorageKey),
    })),
  });
});

provozStaffRouter.post('/workers/:id/payments/presign-signature', async (c) => {
  const id = c.req.param('id');
  const role = c.req.query('role');
  if (role !== 'recipient' && role !== 'issuer') {
    return c.json({ error: 'role=recipient|issuer' }, 400);
  }
  const body = await c.req.json().catch(() => ({}));
  const signatureDataUrl = (body as { signatureDataUrl?: string }).signatureDataUrl;
  const storageKey = `stagebistro/workers/${id}/vpp-signatures/${role}-${crypto.randomUUID()}.png`;

  if (signatureDataUrl) {
    try {
      const { bytes } = parseDataUrl(signatureDataUrl);
      await putStorageBuffer(storageKey, bytes, 'image/png');
      return c.json({ storageKey });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Uložení podpisu selhalo' }, 400);
    }
  }

  if (!isR2Configured()) {
    return c.json({ error: 'Pošlete signatureDataUrl v těle požadavku' }, 400);
  }
  const uploadUrl = await presignPutObject(storageKey, 'image/png');
  return c.json({ uploadUrl, storageKey });
});
