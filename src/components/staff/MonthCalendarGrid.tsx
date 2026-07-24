import type { CalendarDay } from '@/types/staff';
import { cn } from '@/app/components/ui/utils';

const WEEKDAYS = ['PO', 'ÚT', 'ST', 'ČT', 'PÁ', 'SO', 'NE'];

type Props = {
  days: CalendarDay[];
  onDayClick?: (date: string) => void;
  compact?: boolean;
  highlightWorkerId?: string;
  /** Zvýrazní vybrané dny (režim plánování osoby). */
  selectedDates?: Set<string>;
  /** Dny, které nelze odkliknout (např. potvrzená směna). */
  lockedDates?: Set<string>;
};

export function MonthCalendarGrid({
  days,
  onDayClick,
  compact,
  highlightWorkerId,
  selectedDates,
  lockedDates,
}: Props) {
  const personMode = Boolean(selectedDates);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-px bg-black text-white text-center text-xs font-medium">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-black/10 border border-black/10">
        {days.map((day, i) => {
          const clickable = Boolean(day.date && onDayClick);
          const selected = Boolean(day.date && selectedDates?.has(day.date));
          const locked = Boolean(day.date && lockedDates?.has(day.date));
          const workerAssignments = highlightWorkerId
            ? day.assignments.filter((a) => a.workerId === highlightWorkerId)
            : day.assignments;

          return (
            <button
              key={day.date ?? `pad-${i}`}
              type="button"
              disabled={!clickable}
              onClick={() => day.date && onDayClick?.(day.date)}
              className={cn(
                'min-h-[88px] p-1 text-left bg-white align-top',
                compact && 'min-h-[72px] text-[10px]',
                !day.date && 'bg-black/[0.03] cursor-default',
                clickable && !personMode && 'hover:bg-amber-50/80 cursor-pointer',
                personMode && clickable && 'cursor-pointer hover:ring-2 hover:ring-black/20 hover:ring-inset',
                personMode && selected && 'bg-black text-white',
                personMode && locked && selected && 'bg-black/80',
                personMode && !selected && day.date && 'bg-white'
              )}
            >
              {day.dayOfMonth != null && (
                <span
                  className={cn(
                    'font-semibold text-sm block mb-0.5',
                    personMode && selected && 'text-white'
                  )}
                >
                  {day.dayOfMonth}
                  {locked && personMode ? ' ·' : ''}
                </span>
              )}
              {day.events[0] && (
                <p
                  className={cn(
                    'font-medium leading-tight line-clamp-2',
                    compact ? 'text-[9px]' : 'text-[10px]',
                    personMode && selected ? 'text-white/70' : ''
                  )}
                >
                  {day.events[0].titleCz}
                </p>
              )}
              {!personMode && (
                <ul className="mt-1 space-y-0.5">
                  {workerAssignments.slice(0, 3).map((a) => (
                    <li key={a.id} className={cn('leading-tight', compact ? 'text-[9px]' : 'text-[10px]')}>
                      <span
                        className={cn(
                          a.attendanceStatus === 'confirmed' ? 'text-green-700' : 'text-black/80',
                          highlightWorkerId && a.workerId === highlightWorkerId && 'font-semibold'
                        )}
                      >
                        {a.firstName} {a.lastName.charAt(0)}.
                      </span>
                      <span className="text-black/50 block">
                        {a.plannedStart}–{a.plannedEnd}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {personMode && selected && workerAssignments[0] && (
                <p className={cn('mt-1 leading-tight text-white/80', compact ? 'text-[9px]' : 'text-[10px]')}>
                  {workerAssignments[0].plannedStart}–{workerAssignments[0].plannedEnd}
                  {locked ? ' ✓' : ''}
                </p>
              )}
              {personMode && selected && !workerAssignments[0] && (
                <p className={cn('mt-1 leading-tight text-white/60', compact ? 'text-[9px]' : 'text-[10px]')}>
                  nová
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
