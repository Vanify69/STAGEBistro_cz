import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { attendanceRecords, shiftAssignments, wagePaymentLines } from '../db/schema.js';
import { computeWorkedMinutes, formatTimeHm, parseHmOnDate } from './workedMinutes.js';

export function formatTimestampHmPrague(d: Date): string {
  const parts = new Intl.DateTimeFormat('cs-CZ', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

export async function assertAttendanceEditable(attendanceId: string): Promise<void> {
  const db = getDb();
  const [paid] = await db
    .select({ id: wagePaymentLines.id })
    .from(wagePaymentLines)
    .where(eq(wagePaymentLines.attendanceRecordId, attendanceId))
    .limit(1);
  if (paid) {
    throw new Error('Směna je již vyplacena — úprava není možná');
  }
}

function resolveActualRange(businessDate: string, startHm: string, endHm: string) {
  const actualStart = parseHmOnDate(businessDate, startHm);
  let actualEnd = parseHmOnDate(businessDate, endHm);
  if (actualEnd <= actualStart) {
    actualEnd = new Date(actualEnd.getTime() + 24 * 60 * 60 * 1000);
  }
  return { actualStart, actualEnd, workedMinutes: computeWorkedMinutes(actualStart, actualEnd) };
}

export async function updateAttendanceTimes(
  attendanceId: string,
  startHm: string,
  endHm: string,
  editorUserId: string | null
) {
  await assertAttendanceEditable(attendanceId);

  const db = getDb();
  const [row] = await db
    .select({
      attendance: attendanceRecords,
      shift: shiftAssignments,
    })
    .from(attendanceRecords)
    .innerJoin(shiftAssignments, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))
    .where(eq(attendanceRecords.id, attendanceId))
    .limit(1);

  if (!row || row.shift.cancelledAt) {
    throw new Error('Docházka nenalezena');
  }

  const { actualStart, actualEnd, workedMinutes } = resolveActualRange(
    row.shift.businessDate,
    startHm,
    endHm
  );

  const [updated] = await db
    .update(attendanceRecords)
    .set({
      actualStart,
      actualEnd,
      workedMinutes,
      status: 'confirmed',
      confirmedAt: row.attendance.confirmedAt ?? new Date(),
      confirmedBy: editorUserId ?? row.attendance.confirmedBy,
      updatedAt: new Date(),
    })
    .where(eq(attendanceRecords.id, attendanceId))
    .returning();

  return updated!;
}

export async function updateShiftTimesAndSyncAttendance(
  shiftId: string,
  plannedStart: string,
  plannedEnd: string,
  editorUserId: string | null
) {
  const db = getDb();
  const [row] = await db
    .select({
      shift: shiftAssignments,
      attendance: attendanceRecords,
    })
    .from(shiftAssignments)
    .leftJoin(attendanceRecords, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))
    .where(eq(shiftAssignments.id, shiftId))
    .limit(1);

  if (!row || row.shift.cancelledAt) {
    throw new Error('Směna nenalezena');
  }

  if (row.attendance?.id) {
    await assertAttendanceEditable(row.attendance.id);
  }

  const [shift] = await db
    .update(shiftAssignments)
    .set({
      plannedStart: plannedStart.length === 5 ? `${plannedStart}:00` : plannedStart,
      plannedEnd: plannedEnd.length === 5 ? `${plannedEnd}:00` : plannedEnd,
      updatedAt: new Date(),
    })
    .where(eq(shiftAssignments.id, shiftId))
    .returning();

  if (row.attendance?.status === 'confirmed' && row.attendance.id) {
    await updateAttendanceTimes(row.attendance.id, plannedStart, plannedEnd, editorUserId);
  }

  return shift!;
}
