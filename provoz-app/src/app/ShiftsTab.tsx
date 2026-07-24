import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import {
  fetchActiveWorkers,
  fetchMonthCalendar,
  hasPermission,
  saveMonthPlan,
  type CalendarDay,
  type StaffWorker,
} from '@/lib/provozApi';

const BRAND: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif" };
const BODY: React.CSSProperties = { fontFamily: "'DM Sans', sans-serif" };
const WEEKDAYS = ['PO', 'ÚT', 'ST', 'ČT', 'PÁ', 'SO', 'NE'];

function weekdayMon0(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type Props = {
  permissions: string[];
};

export function ShiftsTab({ permissions }: Props) {
  const canPlan = hasPermission(permissions, 'staff.shifts');

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [year, mon] = month.split('-').map(Number);

  const [workers, setWorkers] = useState<StaffWorker[]>([]);
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [workerId, setWorkerId] = useState('');
  const [planStart, setPlanStart] = useState('10:00');
  const [planEnd, setPlanEnd] = useState('22:00');
  const [planDates, setPlanDates] = useState<Set<string>>(() => new Set());
  const [planDirty, setPlanDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load(silent = false) {
    if (!canPlan) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const [w, cal] = await Promise.all([
        fetchActiveWorkers(),
        fetchMonthCalendar(year, mon),
      ]);
      setWorkers(w);
      setDays(cal.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst směny');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, canPlan]);

  const workerShifts = useMemo(() => {
    if (!workerId) return [];
    return days.flatMap((d) => d.assignments.filter((a) => a.workerId === workerId));
  }, [days, workerId]);

  const lockedDates = useMemo(() => {
    const s = new Set<string>();
    for (const a of workerShifts) {
      if (a.attendanceStatus === 'confirmed') s.add(a.businessDate);
    }
    return s;
  }, [workerShifts]);

  const savedDatesKey = useMemo(
    () =>
      [...new Set(workerShifts.map((a) => a.businessDate))]
        .sort()
        .join(','),
    [workerShifts]
  );

  useEffect(() => {
    setPlanDirty(false);
    setMessage(null);
  }, [month]);

  useEffect(() => {
    if (!workerId || planDirty) return;
    setPlanDates(new Set(savedDatesKey ? savedDatesKey.split(',') : []));
  }, [workerId, month, savedDatesKey, planDirty]);

  function toggleDate(date: string) {
    setPlanDirty(true);
    setMessage(null);
    setPlanDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        if (lockedDates.has(date)) return prev;
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }

  function selectByWeekday(kind: 'weekdays' | 'weekend' | 'all' | 'clear') {
    setPlanDirty(true);
    setMessage(null);
    const next = new Set(planDates);
    for (const d of days) {
      if (!d.date) continue;
      const wd = weekdayMon0(d.date);
      const isWeekend = wd >= 5;
      if (kind === 'clear') {
        if (!lockedDates.has(d.date)) next.delete(d.date);
      } else if (kind === 'all') {
        next.add(d.date);
      } else if (kind === 'weekdays' && !isWeekend) {
        next.add(d.date);
      } else if (kind === 'weekend' && isWeekend) {
        next.add(d.date);
      }
    }
    for (const locked of lockedDates) next.add(locked);
    setPlanDates(next);
  }

  async function handleSave() {
    if (!workerId || saving) return;
    setSaving(true);
    setError('');
    setMessage(null);
    try {
      const res = await saveMonthPlan({
        workerId,
        year,
        month: mon,
        plannedStart: planStart,
        plannedEnd: planEnd,
        dates: [...planDates].sort(),
      });
      setPlanDirty(false);
      await load(true);
      const parts = [
        res.created.length ? `+${res.created.length}` : null,
        res.cancelled.length ? `−${res.cancelled.length}` : null,
        res.updated.length ? `upraveno ${res.updated.length}` : null,
      ].filter(Boolean);
      const skip =
        res.skipped.length > 0 ? ` Přeskočeno ${res.skipped.length}.` : '';
      setMessage(
        parts.length || skip
          ? `Uloženo${parts.length ? ` (${parts.join(', ')})` : ''}.${skip}`
          : 'Bez změn.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  }

  if (!canPlan) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center" style={BODY}>
        <p className="text-sm text-muted-foreground">
          Nemáte oprávnění plánovat směny.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={28} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={BODY}>
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <CalendarDays size={18} className="text-muted-foreground" />
        <h2 style={BRAND} className="text-sm font-semibold uppercase tracking-[0.14em]">
          Plán směn
        </h2>
      </div>

      <div className="px-4 pb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="p-2 text-muted-foreground active:text-foreground"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          aria-label="Předchozí měsíc"
        >
          <ChevronLeft size={20} />
        </button>
        <span style={BRAND} className="text-xs font-semibold uppercase tracking-[0.12em] capitalize">
          {monthLabel(month)}
        </span>
        <button
          type="button"
          className="p-2 text-muted-foreground active:text-foreground"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          aria-label="Další měsíc"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="px-4 space-y-3 pb-4">
        <div>
          <label style={BRAND} className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            Brigádník
          </label>
          <select
            value={workerId}
            onChange={(e) => {
              setWorkerId(e.target.value);
              setPlanDirty(false);
              setMessage(null);
            }}
            className="mt-1 w-full bg-secondary border border-border px-3 py-3 text-sm text-foreground outline-none"
          >
            <option value="">Vyberte…</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.firstName} {w.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={BRAND} className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Od
            </label>
            <input
              type="time"
              value={planStart}
              onChange={(e) => {
                setPlanStart(e.target.value);
                setPlanDirty(true);
              }}
              className="mt-1 w-full bg-secondary border border-border px-3 py-3 text-sm text-foreground outline-none"
            />
          </div>
          <div>
            <label style={BRAND} className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              Do
            </label>
            <input
              type="time"
              value={planEnd}
              onChange={(e) => {
                setPlanEnd(e.target.value);
                setPlanDirty(true);
              }}
              className="mt-1 w-full bg-secondary border border-border px-3 py-3 text-sm text-foreground outline-none"
            />
          </div>
        </div>

        {workerId && (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['weekdays', 'Po–Pá'],
                  ['weekend', 'So–Ne'],
                  ['all', 'Celý měsíc'],
                  ['clear', 'Vymazat'],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => selectByWeekday(kind)}
                  className="px-3 py-2 text-[11px] border border-border text-muted-foreground active:bg-secondary"
                  style={BRAND}
                >
                  {label}
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Vybraných dní: <span className="text-foreground">{planDates.size}</span>
              {lockedDates.size > 0 && (
                <span> · {lockedDates.size} potvrzených nelze zrušit</span>
              )}
            </p>

            <div className="border border-border">
              <div className="grid grid-cols-7 bg-secondary text-center">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    style={BRAND}
                    className="py-2 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const selected = Boolean(day.date && planDates.has(day.date));
                  const locked = Boolean(day.date && lockedDates.has(day.date));
                  const assignment = day.date
                    ? day.assignments.find((a) => a.workerId === workerId)
                    : undefined;
                  return (
                    <button
                      key={day.date ?? `pad-${i}`}
                      type="button"
                      disabled={!day.date}
                      onClick={() => day.date && toggleDate(day.date)}
                      className={[
                        'min-h-[52px] border-t border-r border-border p-1 text-left',
                        !day.date ? 'bg-background/40 cursor-default' : '',
                        selected ? 'bg-foreground text-background' : 'bg-background',
                        day.date ? 'active:opacity-80' : '',
                      ].join(' ')}
                    >
                      {day.dayOfMonth != null && (
                        <span className="text-xs font-medium block">{day.dayOfMonth}</span>
                      )}
                      {selected && (
                        <span className="text-[9px] opacity-70 block mt-0.5">
                          {assignment
                            ? `${assignment.plannedStart}–${assignment.plannedEnd}`
                            : 'nová'}
                          {locked ? ' ✓' : ''}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={!planDirty || saving}
              onClick={() => void handleSave()}
              className="w-full bg-foreground text-background py-3.5 disabled:opacity-40 flex items-center justify-center gap-2"
              style={BRAND}
            >
              {saving ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Check size={18} />
              )}
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                {saving ? 'Ukládám…' : 'Uložit plán měsíce'}
              </span>
            </button>

            {planDirty && (
              <button
                type="button"
                className="w-full py-2 text-xs text-muted-foreground"
                onClick={() => {
                  setPlanDates(new Set(savedDatesKey ? savedDatesKey.split(',') : []));
                  setPlanDirty(false);
                  setMessage(null);
                }}
              >
                Zahodit změny
              </button>
            )}
          </>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}
