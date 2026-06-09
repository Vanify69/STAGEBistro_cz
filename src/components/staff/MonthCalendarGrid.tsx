import type { CalendarDay } from '@/types/staff';
import { cn } from '@/app/components/ui/utils';

const WEEKDAYS = ['PO', 'ÚT', 'ST', 'ČT', 'PÁ', 'SO', 'NE'];

type Props = {
  days: CalendarDay[];
  onDayClick?: (date: string) => void;
  compact?: boolean;
  highlightWorkerId?: string;
};

export function MonthCalendarGrid({ days, onDayClick, compact, highlightWorkerId }: Props) {
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
                clickable && 'hover:bg-amber-50/80 cursor-pointer'
              )}
            >
              {day.dayOfMonth != null && (
                <span className="font-semibold text-sm block mb-0.5">{day.dayOfMonth}</span>
              )}
              {day.events[0] && (
                <p className={cn('font-medium leading-tight line-clamp-2', compact ? 'text-[9px]' : 'text-[10px]')}>
                  {day.events[0].titleCz}
                </p>
              )}
              <ul className="mt-1 space-y-0.5">
                {(highlightWorkerId
                  ? day.assignments.filter((a) => a.workerId === highlightWorkerId)
                  : day.assignments
                )
                  .slice(0, 3)
                  .map((a) => (
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
