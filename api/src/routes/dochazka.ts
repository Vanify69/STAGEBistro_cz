import { Hono } from 'hono';

import { z } from 'zod';

import { eq } from 'drizzle-orm';

import { getDb } from '../db/index.js';

import {

  attendanceRecords,

  shiftAssignments,

  workers,

} from '../db/schema.js';

import type { AuthUser } from '../lib/session.js';

import { requireAuth, requirePermission } from '../middleware/auth.js';

import { isValidYmd } from '../lib/pragueDate.js';

import { isR2Configured, presignPutObject } from '../lib/s3.js';
import { parseDataUrl, putStorageBuffer } from '../lib/storage.js';

import { buildMonthCalendar } from '../lib/staffCalendar.js';

import { computeWorkedMinutes, formatTimeHm, parseHmOnDate } from '../lib/workedMinutes.js';
import { auditAction, AUDIT_ACTIONS } from '../lib/auditLog.js';



export const dochazkaRouter = new Hono<{ Variables: { user: AuthUser } }>();



/** Veřejné čtení kalendáře — brigádníci bez přihlášení */

dochazkaRouter.get('/month/:year/:month', async (c) => {

  const year = Number(c.req.param('year'));

  const month = Number(c.req.param('month'));

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {

    return c.json({ error: 'Invalid month' }, 400);

  }

  const calendar = await buildMonthCalendar(year, month);

  return c.json({ calendar });

});



dochazkaRouter.get('/day/:date', async (c) => {

  const date = c.req.param('date');

  if (!isValidYmd(date)) return c.json({ error: 'Invalid date' }, 400);

  const [y, m] = date.split('-').map(Number);

  const calendar = await buildMonthCalendar(y!, m!);

  const day = calendar.days.find((d) => d.date === date);

  if (!day) return c.json({ error: 'Not found' }, 404);

  return c.json({ day });

});



const protectedDochazka = new Hono<{ Variables: { user: AuthUser } }>();

protectedDochazka.use('*', requireAuth);
protectedDochazka.use('*', requirePermission('staff.attendance'));



const attendancePatchSchema = z.object({

  actualStart: z.string().datetime(),

  actualEnd: z.string().datetime(),

  signatureStorageKey: z.string().min(1).optional(),

});



protectedDochazka.post('/attendance/:assignmentId/presign-signature', async (c) => {
  const assignmentId = c.req.param('assignmentId');
  const body = await c.req.json().catch(() => ({}));
  const signatureDataUrl = (body as { signatureDataUrl?: string }).signatureDataUrl;
  const storageKey = `stagebistro/attendance/${assignmentId}/signature-${crypto.randomUUID()}.png`;

  if (signatureDataUrl) {
    try {
      const { bytes } = parseDataUrl(signatureDataUrl);
      await putStorageBuffer(storageKey, bytes, 'image/png');
      return c.json({ storageKey });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : 'Uložení podpisu selhalo' }, 400);
    }
  }

  if (!isR2Configured()) return c.json({ error: 'R2 not configured' }, 503);
  const uploadUrl = await presignPutObject(storageKey, 'image/png');
  return c.json({ uploadUrl, storageKey });
});



protectedDochazka.patch('/attendance/:assignmentId', async (c) => {

  const assignmentId = c.req.param('assignmentId');

  const user = c.get('user');

  const body = await c.req.json().catch(() => null);

  const parsed = attendancePatchSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: 'Invalid body' }, 400);



  const db = getDb();

  const [row] = await db

    .select({

      shift: shiftAssignments,

      worker: workers,

      attendance: attendanceRecords,

    })

    .from(shiftAssignments)

    .innerJoin(workers, eq(shiftAssignments.workerId, workers.id))

    .leftJoin(attendanceRecords, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))

    .where(eq(shiftAssignments.id, assignmentId))

    .limit(1);



  if (!row || row.shift.cancelledAt) return c.json({ error: 'Not found' }, 404);

  if (row.worker.status !== 'active' || row.worker.deletedAt) {

    return c.json({ error: 'Worker not active' }, 400);

  }



  const actualStart = new Date(parsed.data.actualStart);

  const actualEnd = new Date(parsed.data.actualEnd);

  let workedMinutes: number;

  try {

    workedMinutes = computeWorkedMinutes(actualStart, actualEnd);

  } catch (e) {

    return c.json({ error: (e as Error).message }, 400);

  }



  if (parsed.data.signatureStorageKey && !parsed.data.signatureStorageKey.startsWith(`stagebistro/attendance/${assignmentId}/`)) {

    return c.json({ error: 'Invalid storage key' }, 400);

  }



  let att = row.attendance;

  if (!att) {

    const [created] = await db

      .insert(attendanceRecords)

      .values({ shiftAssignmentId: assignmentId })

      .returning();

    att = created!;

  }



  if (att.status === 'confirmed') {

    return c.json({ error: 'Attendance already confirmed' }, 400);

  }



  const [updated] = await db

    .update(attendanceRecords)

    .set({

      actualStart,

      actualEnd,

      workedMinutes,

      status: 'confirmed',

      confirmedAt: new Date(),

      confirmedBy: user.id,

      signatureStorageKey: parsed.data.signatureStorageKey ?? att.signatureStorageKey,

      updatedAt: new Date(),

    })

    .where(eq(attendanceRecords.id, att.id))

    .returning();



  await auditAction(c, {

    action: AUDIT_ACTIONS.staff.attendanceConfirm,

    entityType: 'shift',

    entityId: assignmentId,

    summary: `Potvrzena docházka (portál) za ${row.shift.businessDate}`,

    metadata: { workerId: row.worker.id, source: 'dochazka' },

  });



  return c.json({ attendance: updated });

});



/** Quick confirm using planned times on business date */

protectedDochazka.post('/attendance/:assignmentId/confirm-planned', async (c) => {

  const assignmentId = c.req.param('assignmentId');

  const user = c.get('user');

  const body = await c.req.json().catch(() => ({}));

  const signatureStorageKey = (body as { signatureStorageKey?: string }).signatureStorageKey;



  const db = getDb();

  const [row] = await db

    .select({

      shift: shiftAssignments,

      worker: workers,

      attendance: attendanceRecords,

    })

    .from(shiftAssignments)

    .innerJoin(workers, eq(shiftAssignments.workerId, workers.id))

    .leftJoin(attendanceRecords, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))

    .where(eq(shiftAssignments.id, assignmentId))

    .limit(1);



  if (!row || row.shift.cancelledAt) return c.json({ error: 'Not found' }, 404);



  const startHm = formatTimeHm(String(row.shift.plannedStart));

  const endHm = formatTimeHm(String(row.shift.plannedEnd));

  const actualStart = parseHmOnDate(row.shift.businessDate, startHm);

  let actualEnd = parseHmOnDate(row.shift.businessDate, endHm);

  if (actualEnd <= actualStart) {

    actualEnd = new Date(actualEnd.getTime() + 24 * 60 * 60 * 1000);

  }



  const workedMinutes = computeWorkedMinutes(actualStart, actualEnd);

  let att = row.attendance;

  if (!att) {

    const [created] = await db.insert(attendanceRecords).values({ shiftAssignmentId: assignmentId }).returning();

    att = created!;

  }



  const [updated] = await db

    .update(attendanceRecords)

    .set({

      actualStart,

      actualEnd,

      workedMinutes,

      status: 'confirmed',

      confirmedAt: new Date(),

      confirmedBy: user.id,

      signatureStorageKey: signatureStorageKey ?? att.signatureStorageKey,

      updatedAt: new Date(),

    })

    .where(eq(attendanceRecords.id, att.id))

    .returning();



  await auditAction(c, {

    action: AUDIT_ACTIONS.staff.attendanceConfirm,

    entityType: 'shift',

    entityId: assignmentId,

    summary: `Rychlé potvrzení docházky za ${row.shift.businessDate}`,

    metadata: { workerId: row.worker.id, source: 'dochazka_planned' },

  });



  return c.json({ attendance: updated });

});



dochazkaRouter.route('/', protectedDochazka);

