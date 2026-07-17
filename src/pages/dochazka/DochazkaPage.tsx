import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { provozPathOrLogin } from '@/lib/loginRedirect';
import { usePermissions } from '@/lib/usePermissions';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { MonthCalendarGrid } from '@/components/staff/MonthCalendarGrid';
import { SignaturePad } from '@/components/staff/SignaturePad';
import { uploadSignaturePng } from '@/lib/staffUpload';
import type { CalendarDay, MonthCalendar } from '@/types/staff';

type MeResponse = import('@/lib/permissions').MeResponse;

const MY_WORKER_KEY = 'dochazka-my-worker-id';

function telHref(phone: string) {
  return `tel:${phone.replace(/\s+/g, '')}`;
}

export default function DochazkaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { can, canAccessAdmin } = usePermissions();
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
  });
  const canManageAttendance = can('staff.attendance');

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const parts = month.split('-').map(Number);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [myWorkerId, setMyWorkerId] = useState<string>(() => {
    try {
      return localStorage.getItem(MY_WORKER_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const calQ = useQuery({
    queryKey: ['dochazka', 'month', month],
    queryFn: () =>
      apiFetch<{ calendar: MonthCalendar }>(`/api/dochazka/month/${parts[0]}/${parts[1]}`),
    enabled: parts.length === 2,
  });

  const workersInMonth = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    calQ.data?.calendar.days.forEach((d) =>
      d.assignments.forEach((a) => {
        if (!map.has(a.workerId)) {
          map.set(a.workerId, { id: a.workerId, label: `${a.firstName} ${a.lastName}` });
        }
      })
    );
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  }, [calQ.data]);

  const day: CalendarDay | undefined = selectedDate
    ? calQ.data?.calendar.days.find((d) => d.date === selectedDate)
    : undefined;

  const visibleAssignments = useMemo(() => {
    if (!day) return [];
    if (!myWorkerId) return day.assignments;
    return day.assignments.filter((a) => a.workerId === myWorkerId);
  }, [day, myWorkerId]);

  const assignment = day?.assignments.find((a) => a.id === assignmentId);

  const confirm = useMutation({
    mutationFn: async () => {
      if (!assignmentId || !start || !end) throw new Error('Vyplňte časy');
      let signatureKey: string | undefined;
      if (signature) {
        signatureKey = await uploadSignaturePng(
          `/api/dochazka/attendance/${assignmentId}/presign-signature`,
          signature
        );
      }
      const startIso = new Date(`${selectedDate}T${start}:00`).toISOString();
      const endIso = new Date(`${selectedDate}T${end}:00`).toISOString();
      return apiFetch(`/api/dochazka/attendance/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          actualStart: startIso,
          actualEnd: endIso,
          signatureStorageKey: signatureKey,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dochazka', 'month', month] });
      setAssignmentId(null);
      setSelectedDate(null);
      setSignature(null);
    },
  });

  const updateAttendance = useMutation({
    mutationFn: async () => {
      if (!assignment?.attendanceId || !start || !end) throw new Error('Vyplňte časy');
      return apiFetch(`/api/provoz/attendance/${assignment.attendanceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ actualStart: start, actualEnd: end }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dochazka', 'month', month] });
      setAssignmentId(null);
      setSelectedDate(null);
    },
  });

  const quickConfirm = useMutation({
    mutationFn: async (aid: string) => {
      let signatureKey: string | undefined;
      if (signature) {
        signatureKey = await uploadSignaturePng(`/api/dochazka/attendance/${aid}/presign-signature`, signature);
      }
      return apiFetch(`/api/dochazka/attendance/${aid}/confirm-planned`, {
        method: 'POST',
        body: JSON.stringify({ signatureStorageKey: signatureKey }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dochazka', 'month', month] }),
  });

  const planHref = `/provoz/plan?month=${encodeURIComponent(month)}${selectedDate ? `&date=${selectedDate}` : ''}`;
  const planLinkTo = provozPathOrLogin(planHref, canManageAttendance);

  const handleMyWorkerChange = (id: string) => {
    setMyWorkerId(id);
    try {
      if (id) localStorage.setItem(MY_WORKER_KEY, id);
      else localStorage.removeItem(MY_WORKER_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-white text-black w-full max-w-5xl mx-auto">
      <header className="px-4 md:px-6 py-3 border-b border-black/10 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-medium tracking-tight">Docházka</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" type="button" asChild>
            <Link to={planLinkTo}>Plán směn</Link>
          </Button>
          {canManageAttendance && (
            <Button variant="outline" size="sm" type="button" onClick={() => navigate('/provoz/trzby')}>
              Provoz
            </Button>
          )}
          {canAccessAdmin && (
            <Button variant="outline" size="sm" type="button" onClick={() => navigate('/admin')}>
              Admin
            </Button>
          )}
        </div>
      </header>
      <main className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-black/60">Měsíc</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-xs" />
          </div>
          {workersInMonth.length > 0 && (
            <div>
              <Label className="text-xs text-black/60">Jsem</Label>
              <select
                className="flex h-9 w-full min-w-[180px] rounded-md border border-black/20 bg-white px-3 text-sm"
                value={myWorkerId}
                onChange={(e) => handleMyWorkerChange(e.target.value)}
              >
                <option value="">Všichni</option>
                {workersInMonth.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {calQ.isLoading && <p className="text-sm text-black/60">Načítání kalendáře…</p>}
        {calQ.isError && (
          <p className="text-sm text-red-700 border border-red-200 bg-red-50 rounded p-3">
            Kalendář se nepodařilo načíst: {calQ.error instanceof Error ? calQ.error.message : 'chyba API'}
          </p>
        )}
        {calQ.data?.calendar && (
          <MonthCalendarGrid
            days={calQ.data.calendar.days}
            onDayClick={setSelectedDate}
            highlightWorkerId={myWorkerId || undefined}
          />
        )}

        {selectedDate && !assignmentId && day && (
          <section className="border border-black/10 rounded p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">{selectedDate}</h2>
              <Button variant="outline" size="sm" type="button" asChild>
                <Link
                  to={provozPathOrLogin(
                    `/provoz/plan?month=${encodeURIComponent(month)}&date=${selectedDate}`,
                    canManageAttendance
                  )}
                >
                  Přidat směnu
                </Link>
              </Button>
            </div>
            {day.events[0] && <p className="text-sm text-black/70">{day.events[0].titleCz}</p>}
            <ul className="space-y-2">
              {visibleAssignments.length === 0 && (
                <li className="text-sm text-black/50">
                  {myWorkerId ? 'Tento den nemáte naplánovanou směnu.' : 'Žádné naplánované směny.'}
                </li>
              )}
              {visibleAssignments.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="w-full text-left border border-black/10 p-2 rounded hover:bg-amber-50"
                    onClick={() => {
                      setAssignmentId(a.id);
                      setStart(a.actualStart ?? a.plannedStart);
                      setEnd(a.actualEnd ?? a.plannedEnd);
                    }}
                  >
                    <span className="font-medium">
                      {a.firstName} {a.lastName}
                    </span>
                    <span className="block text-xs text-black/60">
                      {a.attendanceStatus === 'confirmed' && a.actualStart
                        ? `${a.actualStart}–${a.actualEnd}`
                        : `${a.plannedStart}–${a.plannedEnd}`}
                      {a.attendanceStatus === 'confirmed' ? ' · potvrzeno' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" onClick={() => setSelectedDate(null)}>
              Zavřít
            </Button>
          </section>
        )}

        {assignmentId && assignment && (
          <section className="border border-black/10 rounded p-4 space-y-3 max-w-lg">
            <h2 className="font-medium">
              {assignment.firstName} {assignment.lastName}
            </h2>
            <p className="text-sm text-black/70">
              {selectedDate} · {assignment.plannedStart}–{assignment.plannedEnd}
            </p>
            {assignment.phone ? (
              <p className="text-sm">
                Telefon:{' '}
                <a href={telHref(assignment.phone)} className="text-amber-800 underline font-medium">
                  {assignment.phone}
                </a>
              </p>
            ) : (
              <p className="text-sm text-black/50">Telefon není vyplněný.</p>
            )}

            {canManageAttendance ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Příchod</Label>
                    <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                  </div>
                  <div>
                    <Label>Odchod</Label>
                    <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                  </div>
                </div>
                {assignment.attendanceStatus === 'confirmed' ? (
                  <>
                    <p className="text-sm text-green-700">Směna potvrzena — provoz může upravit časy.</p>
                    <Button
                      type="button"
                      onClick={() => updateAttendance.mutate()}
                      disabled={updateAttendance.isPending || !assignment.attendanceId}
                    >
                      Uložit změny
                    </Button>
                    {updateAttendance.isError && (
                      <p className="text-sm text-red-600">{(updateAttendance.error as Error).message}</p>
                    )}
                  </>
                ) : (
                  <>
                    <Label>Podpis brigádníka</Label>
                    <SignaturePad onChange={setSignature} />
                    <Button type="button" onClick={() => confirm.mutate()} disabled={confirm.isPending}>
                      Potvrdit docházku
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => quickConfirm.mutate(assignmentId)}
                      disabled={quickConfirm.isPending}
                    >
                      Potvrdit dle plánu
                    </Button>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-black/60">
                {assignment.attendanceStatus === 'confirmed'
                  ? 'Směna je potvrzena.'
                  : 'Plánovaná směna — potvrzení docházky provádí provoz.'}
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => setAssignmentId(null)}>
              Zpět
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
