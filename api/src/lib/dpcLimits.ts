import { and, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  attendanceRecords,
  shiftAssignments,
  wagePaymentLines,
  wagePayments,
  workers,
} from '../db/schema.js';
import {
  DPC_MONTHLY_LIMIT_CENTS,
  DPC_YEARLY_MINUTES_LIMIT,
} from './dpcConstants.js';
import { paidAtPragueYearMonth } from './pragueDate.js';

export async function getWorkerYearWorkedMinutes(workerId: string, year: number): Promise<number> {
  const db = getDb();
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${attendanceRecords.workedMinutes}), 0)::int`,
    })
    .from(attendanceRecords)
    .innerJoin(shiftAssignments, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))
    .where(
      and(
        eq(shiftAssignments.workerId, workerId),
        eq(attendanceRecords.status, 'confirmed'),
        gte(shiftAssignments.businessDate, start),
        lte(shiftAssignments.businessDate, end),
        isNull(shiftAssignments.cancelledAt)
      )
    );
  return Number(row?.total ?? 0);
}

export async function getWorkerMonthPaidCents(
  workerId: string,
  year: number,
  month: number
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ amountCents: wagePayments.amountCents, paidAt: wagePayments.paidAt })
    .from(wagePayments)
    .where(eq(wagePayments.workerId, workerId));
  return rows
    .filter((r) => {
      const ym = paidAtPragueYearMonth(r.paidAt);
      return ym.year === year && ym.month === month;
    })
    .reduce((s, r) => s + r.amountCents, 0);
}

export type LimitCheckResult = {
  yearWorkedMinutes: number;
  yearRemainingMinutes: number;
  yearBlocked: boolean;
  monthPaidCents: number;
  monthRemainingCents: number;
  monthWouldExceed: boolean;
  proposedAmountCents: number;
};

export function checkLimits(
  yearWorkedMinutes: number,
  monthPaidCents: number,
  proposedAmountCents: number
): LimitCheckResult {
  const yearRemainingMinutes = DPC_YEARLY_MINUTES_LIMIT - yearWorkedMinutes;
  const yearBlocked = yearWorkedMinutes >= DPC_YEARLY_MINUTES_LIMIT;
  const monthTotal = monthPaidCents + proposedAmountCents;
  const monthWouldExceed = monthTotal > DPC_MONTHLY_LIMIT_CENTS;
  const monthRemainingCents = Math.max(0, DPC_MONTHLY_LIMIT_CENTS - monthPaidCents);
  return {
    yearWorkedMinutes,
    yearRemainingMinutes,
    yearBlocked,
    monthPaidCents,
    monthRemainingCents,
    monthWouldExceed,
    proposedAmountCents,
  };
}

export async function buildLimitCheck(
  workerId: string,
  proposedAmountCents: number,
  refDate: Date
): Promise<LimitCheckResult> {
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1;
  const yearWorkedMinutes = await getWorkerYearWorkedMinutes(workerId, year);
  const monthPaidCents = await getWorkerMonthPaidCents(workerId, year, month);
  return checkLimits(yearWorkedMinutes, monthPaidCents, proposedAmountCents);
}

export async function assertWorkerCanSchedule(workerId: string, year: number): Promise<void> {
  const minutes = await getWorkerYearWorkedMinutes(workerId, year);
  if (minutes >= DPC_YEARLY_MINUTES_LIMIT) {
    throw new Error('Brigádník dosáhl ročního limitu 300 hodin');
  }
}

export async function listUnpaidAttendance(workerId: string) {
  const db = getDb();
  const all = await db
    .select({
      attendance: attendanceRecords,
      shift: shiftAssignments,
    })
    .from(attendanceRecords)
    .innerJoin(shiftAssignments, eq(attendanceRecords.shiftAssignmentId, shiftAssignments.id))
    .where(
      and(
        eq(shiftAssignments.workerId, workerId),
        eq(attendanceRecords.status, 'confirmed'),
        isNull(shiftAssignments.cancelledAt)
      )
    );

  if (!all.length) return [];

  const attIds = all.map((r) => r.attendance.id);
  const paidLines = await db
    .select({ attendanceRecordId: wagePaymentLines.attendanceRecordId })
    .from(wagePaymentLines)
    .where(inArray(wagePaymentLines.attendanceRecordId, attIds));

  const paidSet = new Set(paidLines.map((p) => p.attendanceRecordId));
  return all.filter((r) => !paidSet.has(r.attendance.id));
}

export async function getWorkerStats(workerId: string, refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1;
  const yearWorkedMinutes = await getWorkerYearWorkedMinutes(workerId, year);
  const monthPaidCents = await getWorkerMonthPaidCents(workerId, year, month);
  const unpaid = await listUnpaidAttendance(workerId);
  const unpaidMinutes = unpaid.reduce((s, r) => s + (r.attendance.workedMinutes ?? 0), 0);
  const workerRow = await getDb()
    .select({ hourlyRateCents: workers.hourlyRateCents })
    .from(workers)
    .where(eq(workers.id, workerId))
    .limit(1);
  const rate = workerRow[0]?.hourlyRateCents ?? 0;
  const unpaidCents = Math.round((unpaidMinutes / 60) * rate);
  return {
    yearWorkedMinutes,
    yearWorkedHours: Math.round((yearWorkedMinutes / 60) * 100) / 100,
    yearRemainingMinutes: Math.max(0, DPC_YEARLY_MINUTES_LIMIT - yearWorkedMinutes),
    monthPaidCents,
    monthRemainingCents: Math.max(0, DPC_MONTHLY_LIMIT_CENTS - monthPaidCents),
    unpaidMinutes,
    unpaidCents,
    unpaidShiftCount: unpaid.length,
    yearBlocked: yearWorkedMinutes >= DPC_YEARLY_MINUTES_LIMIT,
  };
}
