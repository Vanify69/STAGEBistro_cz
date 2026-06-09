export type WorkerStatus = 'draft' | 'contract_pending' | 'active' | 'inactive';

export type Worker = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  position: string;
  workPlace: string;
  hourlyRateCents: number;
  contractStart: string | null;
  contractEnd: string | null;
  status: WorkerStatus;
  contractPdfKey: string | null;
  contractSource: 'generated' | 'scan' | null;
  contractPdfUrl: string | null;
  contractDownloadPath: string | null;
  contractFilePath: string | null;
  contractSignedAt: string | null;
  contractAccountingSeenAt: string | null;
  contractAccountingEmailedAt: string | null;
  deletedAt: string | null;
};

export type WorkerStats = {
  yearWorkedMinutes: number;
  yearWorkedHours: number;
  yearRemainingMinutes: number;
  monthPaidCents: number;
  monthRemainingCents: number;
  unpaidMinutes: number;
  unpaidCents: number;
  unpaidShiftCount: number;
  yearBlocked: boolean;
};

export type CalendarDay = {
  date: string | null;
  dayOfMonth: number | null;
  events: { id: string; titleCz: string; timeText: string | null }[];
  assignments: {
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
  }[];
};

export type MonthCalendar = {
  year: number;
  month: number;
  startWeekday: number;
  days: CalendarDay[];
};

export type WagePayment = {
  id: string;
  vppNumber: string;
  paidAt: string;
  amountCents: number;
  workedMinutesTotal: number;
  reason: string;
  pdfUrl: string | null;
};
