import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import {
  attendanceRecords,
  headerEvents,
  shiftAssignments,
  workers,
} from '../db/schema.js';
import { formatTimestampHmPrague } from './attendanceUpdate.js';
import { formatTimeHm } from './workedMinutes.js';
import { monthBounds, weekdayIndexPrague } from './pragueDate.js';

export type CalendarAssignment = {
  id: string;
  workerId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  position: string;
  businessDate: string;
  plannedStart: string;
  plannedEnd: string;
  note: string | null;
  attendanceId: string | null;
  attendanceStatus: 'open' | 'confirmed' | null;
  actualStart: string | null;
  actualEnd: string | null;
  workedMinutes: number | null;
};

export type CalendarDay = {
  date: string | null;
  dayOfMonth: number | null;
  events: { id: string; titleCz: string; timeText: string | null }[];
  assignments: CalendarAssignment[];
};

export async function buildMonthCalendar(year: number, month: number): Promise<{
  year: number;
  month: number;
  startWeekday: number;
  days: CalendarDay[];
}> {
  const { start, end, daysInMonth } = monthBounds(year, month);
  const db = getDb();

  const events = await db
    .select()
    .from(headerEvents)
    .where(and(gte(headerEvents.eventDate, start), lte(headerEvents.eventDate, end)))
    .orderBy(asc(headerEvents.eventDate), asc(headerEvents.sortOrder));

  const shifts = await db
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
        gte(shiftAssignments.businessDate, start),
        lte(shiftAssignments.businessDate, end),
        isNull(shiftAssignments.cancelledAt),
        isNull(workers.deletedAt)
      )
    )
    .orderBy(asc(shiftAssignments.businessDate));

  const startWeekday = weekdayIndexPrague(start);
  const days: CalendarDay[] = [];

  for (let i = 0; i < startWeekday; i++) {
    days.push({ date: null, dayOfMonth: null, events: [], assignments: [] });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    const dayEvents = events
      .filter((e) => e.eventDate === ymd)
      .map((e) => ({ id: e.id, titleCz: e.titleCz, timeText: e.timeText }));
    const dayAssignments: CalendarAssignment[] = shifts
      .filter((s) => s.shift.businessDate === ymd)
      .map((s) => ({
        id: s.shift.id,
        workerId: s.worker.id,
        firstName: s.worker.firstName,
        lastName: s.worker.lastName,
        phone: s.worker.phone,
        position: s.worker.position,
        businessDate: s.shift.businessDate,
        plannedStart: formatTimeHm(String(s.shift.plannedStart)),
        plannedEnd: formatTimeHm(String(s.shift.plannedEnd)),
        note: s.shift.note,
        attendanceId: s.attendance?.id ?? null,
        attendanceStatus: s.attendance?.status ?? null,
        actualStart:
          s.attendance?.status === 'confirmed' && s.attendance.actualStart
            ? formatTimestampHmPrague(s.attendance.actualStart)
            : null,
        actualEnd:
          s.attendance?.status === 'confirmed' && s.attendance.actualEnd
            ? formatTimestampHmPrague(s.attendance.actualEnd)
            : null,
        workedMinutes: s.attendance?.workedMinutes ?? null,
      }));
    days.push({ date: ymd, dayOfMonth: d, events: dayEvents, assignments: dayAssignments });
  }

  while (days.length % 7 !== 0) {
    days.push({ date: null, dayOfMonth: null, events: [], assignments: [] });
  }

  return { year, month, startWeekday, days };
}
