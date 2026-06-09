import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { attendanceRecords, shiftAssignments } from '../db/schema.js';
import { computeWorkedMinutes, formatTimeHm, parseHmOnDate } from './workedMinutes.js';

export async function listUnconfirmedShifts(workerId: string) {
  const db = getDb();
  const rows = await db
    .select({
      shift: shiftAssignments,
      attendance: attendanceRecords,
    })
    .from(shiftAssignments)
    .leftJoin(attendanceRecords, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))
    .where(
      and(
        eq(shiftAssignments.workerId, workerId),
        isNull(shiftAssignments.cancelledAt),
        or(isNull(attendanceRecords.id), eq(attendanceRecords.status, 'open'))
      )
    )
    .orderBy(asc(shiftAssignments.businessDate));

  return rows.map((r) => ({
    shiftId: r.shift.id,
    attendanceId: r.attendance?.id ?? null,
    businessDate: r.shift.businessDate,
    plannedStart: formatTimeHm(String(r.shift.plannedStart)),
    plannedEnd: formatTimeHm(String(r.shift.plannedEnd)),
  }));
}

export async function confirmPlannedAttendance(
  assignmentId: string,
  confirmedBy: string | null,
  signatureStorageKey?: string | null,
  overrideStartHm?: string,
  overrideEndHm?: string
) {
  const db = getDb();
  const [row] = await db
    .select({
      shift: shiftAssignments,
      attendance: attendanceRecords,
    })
    .from(shiftAssignments)
    .leftJoin(attendanceRecords, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))
    .where(eq(shiftAssignments.id, assignmentId))
    .limit(1);

  if (!row || row.shift.cancelledAt) {
    throw new Error('Směna nenalezena');
  }

  if (row.attendance?.status === 'confirmed') {
    throw new Error('Docházka je již potvrzena');
  }

  const startHm = overrideStartHm ?? formatTimeHm(String(row.shift.plannedStart));
  const endHm = overrideEndHm ?? formatTimeHm(String(row.shift.plannedEnd));
  const actualStart = parseHmOnDate(row.shift.businessDate, startHm);
  let actualEnd = parseHmOnDate(row.shift.businessDate, endHm);
  if (actualEnd <= actualStart) {
    actualEnd = new Date(actualEnd.getTime() + 24 * 60 * 60 * 1000);
  }

  const workedMinutes = computeWorkedMinutes(actualStart, actualEnd);
  let att = row.attendance;
  if (!att) {
    const [created] = await db
      .insert(attendanceRecords)
      .values({ shiftAssignmentId: assignmentId })
      .returning();
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
      confirmedBy,
      signatureStorageKey: signatureStorageKey ?? att.signatureStorageKey,
      updatedAt: new Date(),
    })
    .where(eq(attendanceRecords.id, att.id))
    .returning();

  return updated!;
}
