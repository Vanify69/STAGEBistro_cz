import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { MonthCalendarGrid } from '@/components/staff/MonthCalendarGrid';
import type { CalendarDay, MonthCalendar, Worker } from '@/types/staff';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { cn } from '@/app/components/ui/utils';

type CalendarAssignment = CalendarDay['assignments'][number];
type PlanMode = 'overview' | 'person';

function weekdayMon0(dateStr: string): number {
  // 0=Mon … 6=Sun
  const d = new Date(`${dateStr}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

export default function ShiftPlanPage() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<PlanMode>('overview');
  const [month, setMonth] = useState(() => searchParams.get('month') ?? new Date().toISOString().slice(0, 7));
  const [year, mon] = month.split('-').map(Number);
  const [selectedDate, setSelectedDate] = useState<string | null>(searchParams.get('date'));
  const [editingShift, setEditingShift] = useState<CalendarAssignment | null>(null);

  useEffect(() => {
    const m = searchParams.get('month');
    const d = searchParams.get('date');
    if (m) setMonth(m);
    if (d) setSelectedDate(d);
  }, [searchParams]);

  const [workerId, setWorkerId] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('22:00');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  /** Režim plánování osoby — lokální výběr dní před uložením. */
  const [planWorkerId, setPlanWorkerId] = useState('');
  const [planStart, setPlanStart] = useState('10:00');
  const [planEnd, setPlanEnd] = useState('22:00');
  const [planDates, setPlanDates] = useState<Set<string>>(() => new Set());
  const [planDirty, setPlanDirty] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  const calQ = useQuery({
    queryKey: ['provoz', 'calendar', month],
    queryFn: () =>
      apiFetch<{ calendar: MonthCalendar }>(`/api/provoz/calendar/${year}/${mon}`),
    enabled: allowed && Boolean(year && mon),
  });

  const workersQ = useQuery({
    queryKey: ['provoz', 'workers'],
    queryFn: () => apiFetch<{ workers: Worker[] }>('/api/provoz/workers'),
    enabled: allowed,
  });

  const activeWorkers = (workersQ.data?.workers ?? []).filter((w) => w.status === 'active');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['provoz', 'calendar', month] });
    qc.invalidateQueries({ queryKey: ['dochazka', 'month', month] });
  };

  const workerShiftsInMonth = useMemo(() => {
    if (!planWorkerId || !calQ.data?.calendar) return [];
    return calQ.data.calendar.days.flatMap((d) =>
      d.assignments.filter((a) => a.workerId === planWorkerId)
    );
  }, [calQ.data, planWorkerId]);

  const lockedDates = useMemo(() => {
    const s = new Set<string>();
    for (const a of workerShiftsInMonth) {
      if (a.attendanceStatus === 'confirmed') s.add(a.businessDate);
    }
    return s;
  }, [workerShiftsInMonth]);

  const savedDates = useMemo(
    () => new Set(workerShiftsInMonth.map((a) => a.businessDate)),
    [workerShiftsInMonth]
  );

  const savedDatesKey = useMemo(
    () => [...savedDates].sort().join(','),
    [savedDates]
  );

  // Načti výchozí výběr při změně osoby / měsíce / dat z API (pokud nejsou neuložené změny).
  useEffect(() => {
    if (!planWorkerId || planDirty) return;
    setPlanDates(new Set(savedDatesKey ? savedDatesKey.split(',') : []));
  }, [planWorkerId, month, savedDatesKey, planDirty]);

  useEffect(() => {
    setPlanDirty(false);
    setPlanMessage(null);
    setPlanDates(new Set());
  }, [month]);

  const addShift = useMutation({
    mutationFn: () =>
      apiFetch('/api/provoz/shifts', {
        method: 'POST',
        body: JSON.stringify({
          workerId,
          businessDate: selectedDate,
          plannedStart: start,
          plannedEnd: end,
        }),
      }),
    onSuccess: () => {
      invalidate();
      setWorkerId('');
    },
  });

  const updateShift = useMutation({
    mutationFn: () => {
      if (!editingShift) throw new Error('Žádná směna');
      return apiFetch(`/api/provoz/shifts/${editingShift.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ plannedStart: editStart, plannedEnd: editEnd }),
      });
    },
    onSuccess: () => {
      invalidate();
      setEditingShift(null);
    },
  });

  const cancelShift = useMutation({
    mutationFn: (shiftId: string) =>
      apiFetch(`/api/provoz/shifts/${shiftId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      setEditingShift(null);
    },
  });

  const saveMonthPlan = useMutation({
    mutationFn: () =>
      apiFetch<{
        created: string[];
        cancelled: string[];
        updated: string[];
        skipped: { date: string; reason: string }[];
      }>('/api/provoz/shifts/month-plan', {
        method: 'PUT',
        body: JSON.stringify({
          workerId: planWorkerId,
          year,
          month: mon,
          plannedStart: planStart,
          plannedEnd: planEnd,
          dates: [...planDates].sort(),
        }),
      }),
    onSuccess: (res) => {
      setPlanDirty(false);
      invalidate();
      const parts = [
        res.created.length ? `+${res.created.length}` : null,
        res.cancelled.length ? `−${res.cancelled.length}` : null,
        res.updated.length ? `upraveno ${res.updated.length}` : null,
      ].filter(Boolean);
      const skip =
        res.skipped.length > 0
          ? ` Přeskočeno ${res.skipped.length}: ${res.skipped.map((s) => s.date).join(', ')}`
          : '';
      setPlanMessage(
        parts.length || skip
          ? `Uloženo${parts.length ? ` (${parts.join(', ')})` : ''}.${skip}`
          : 'Bez změn.'
      );
    },
  });

  const day = selectedDate ? calQ.data?.calendar.days.find((d) => d.date === selectedDate) : null;

  const openEdit = (a: CalendarAssignment) => {
    setEditingShift(a);
    setEditStart(a.actualStart ?? a.plannedStart);
    setEditEnd(a.actualEnd ?? a.plannedEnd);
  };

  function togglePlanDate(date: string) {
    setPlanDirty(true);
    setPlanMessage(null);
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
    if (!calQ.data?.calendar) return;
    setPlanDirty(true);
    setPlanMessage(null);
    const next = new Set(planDates);
    for (const d of calQ.data.calendar.days) {
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
    // Zachovej zamčené
    for (const locked of lockedDates) next.add(locked);
    setPlanDates(next);
  }

  const planWorker = activeWorkers.find((w) => w.id === planWorkerId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-lg font-medium">Plán směn</h2>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-xs" />
      </div>

      <div className="inline-flex border border-black/10">
        <button
          type="button"
          className={cn(
            'px-4 py-2 text-sm',
            mode === 'overview' ? 'bg-black text-white' : 'bg-white hover:bg-black/5'
          )}
          onClick={() => setMode('overview')}
        >
          Přehled měsíce
        </button>
        <button
          type="button"
          className={cn(
            'px-4 py-2 text-sm border-l border-black/10',
            mode === 'person' ? 'bg-black text-white' : 'bg-white hover:bg-black/5'
          )}
          onClick={() => setMode('person')}
        >
          Plánovat osobu
        </button>
      </div>

      {mode === 'person' && (
        <section className="space-y-4 border border-black/10 p-4">
          <div>
            <h3 className="font-medium">Měsíční plán pro brigádníka</h3>
            <p className="mt-1 text-sm text-black/60">
              Vyberte osobu, nastavte čas směny a klikáním označte dny. Pak uložte celý měsíc najednou.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Brigádník</Label>
              <Select
                value={planWorkerId}
                onValueChange={(id) => {
                  setPlanWorkerId(id);
                  setPlanDirty(false);
                  setPlanMessage(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte" />
                </SelectTrigger>
                <SelectContent>
                  {activeWorkers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.firstName} {w.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Od</Label>
              <Input type="time" value={planStart} onChange={(e) => { setPlanStart(e.target.value); setPlanDirty(true); }} />
            </div>
            <div>
              <Label>Do</Label>
              <Input type="time" value={planEnd} onChange={(e) => { setPlanEnd(e.target.value); setPlanDirty(true); }} />
            </div>
          </div>

          {planWorkerId && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => selectByWeekday('weekdays')}>
                  Po–Pá
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => selectByWeekday('weekend')}>
                  So–Ne
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => selectByWeekday('all')}>
                  Celý měsíc
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => selectByWeekday('clear')}>
                  Vymazat výběr
                </Button>
              </div>

              <p className="text-sm text-black/60">
                {planWorker ? `${planWorker.firstName} ${planWorker.lastName}` : ''} — vybraných dní:{' '}
                <strong>{planDates.size}</strong>
                {lockedDates.size > 0 && (
                  <span className="text-black/45"> ({lockedDates.size} potvrzených nelze zrušit klikem)</span>
                )}
              </p>

              {calQ.data?.calendar && (
                <MonthCalendarGrid
                  days={calQ.data.calendar.days}
                  highlightWorkerId={planWorkerId}
                  selectedDates={planDates}
                  lockedDates={lockedDates}
                  onDayClick={togglePlanDate}
                  compact
                />
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-black/10 pt-3">
                <Button
                  type="button"
                  disabled={!planWorkerId || saveMonthPlan.isPending || !planDirty}
                  onClick={() => saveMonthPlan.mutate()}
                >
                  {saveMonthPlan.isPending ? 'Ukládám…' : 'Uložit plán měsíce'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!planDirty}
                  onClick={() => {
                    setPlanDates(new Set(savedDates));
                    setPlanDirty(false);
                    setPlanMessage(null);
                  }}
                >
                  Zahodit změny
                </Button>
              </div>
              {saveMonthPlan.isError && (
                <p className="text-sm text-red-600">{(saveMonthPlan.error as Error).message}</p>
              )}
              {planMessage && <p className="text-sm text-green-800">{planMessage}</p>}
            </>
          )}
        </section>
      )}

      {mode === 'overview' && (
        <>
          {calQ.data?.calendar && (
            <MonthCalendarGrid days={calQ.data.calendar.days} onDayClick={(d) => setSelectedDate(d)} />
          )}
          {selectedDate && (
            <section className="border border-black/10 p-4 rounded space-y-3">
              <h3 className="font-medium">{selectedDate}</h3>
              {day?.events[0] && <p className="text-sm">{day.events[0].titleCz}</p>}
              <ul className="text-sm space-y-1">
                {day?.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => openEdit(a)}
                    >
                      {a.firstName} {a.lastName}{' '}
                      {a.attendanceStatus === 'confirmed' && a.actualStart
                        ? `${a.actualStart}–${a.actualEnd}`
                        : `${a.plannedStart}–${a.plannedEnd}`}
                      {a.attendanceStatus === 'confirmed' ? ' · potvrzeno' : ''}
                    </button>
                  </li>
                ))}
              </ul>

              {editingShift && (
                <div className="border border-black/10 rounded p-3 space-y-2 bg-black/[0.02]">
                  <p className="font-medium text-sm">
                    Upravit: {editingShift.firstName} {editingShift.lastName}
                  </p>
                  {editingShift.attendanceStatus === 'confirmed' && (
                    <p className="text-xs text-black/50">
                      Potvrzená směna — změna času upraví i započítané hodiny (nelze po výplatě).
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 max-w-xs">
                    <div>
                      <Label>Od</Label>
                      <Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                    </div>
                    <div>
                      <Label>Do</Label>
                      <Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                    </div>
                  </div>
                  {updateShift.isError && (
                    <p className="text-sm text-red-600">{(updateShift.error as Error).message}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => updateShift.mutate()} disabled={updateShift.isPending}>
                      Uložit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-700"
                      onClick={() => cancelShift.mutate(editingShift.id)}
                      disabled={cancelShift.isPending}
                    >
                      Zrušit směnu
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditingShift(null)}>
                      Zavřít
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-2 max-w-sm border-t border-black/10 pt-3">
                <p className="text-sm font-medium">Přidat směnu</p>
                <Label>Brigádník</Label>
                <Select value={workerId} onValueChange={setWorkerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeWorkers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.firstName} {w.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Label>Od</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                <Label>Do</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              {addShift.isError && <p className="text-sm text-red-600">{(addShift.error as Error).message}</p>}
              <Button type="button" onClick={() => addShift.mutate()} disabled={!workerId || addShift.isPending}>
                Přidat směnu
              </Button>
              <Button type="button" variant="outline" onClick={() => { setSelectedDate(null); setEditingShift(null); }}>
                Zavřít den
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
