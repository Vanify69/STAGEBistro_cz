import { useEffect, useState } from 'react';
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

type CalendarAssignment = CalendarDay['assignments'][number];

export default function ShiftPlanPage() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const [searchParams] = useSearchParams();
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

  const day = selectedDate ? calQ.data?.calendar.days.find((d) => d.date === selectedDate) : null;

  const openEdit = (a: CalendarAssignment) => {
    setEditingShift(a);
    setEditStart(a.actualStart ?? a.plannedStart);
    setEditEnd(a.actualEnd ?? a.plannedEnd);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Plán směn</h2>
      <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-xs" />
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
    </div>
  );
}
