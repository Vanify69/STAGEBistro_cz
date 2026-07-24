import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { usePermissions } from '@/lib/usePermissions';

type Daily = {
  businessDate: string;
  cashCents: number;
  cardCents: number;
  depositCents: number;
  bankCents: number;
  staffCents: number;
  notes: string | null;
} | null;

function kcToCents(v: string): number {
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToKc(cents: number): string {
  return String(Math.round(cents) / 100);
}

export default function ProvozTrzbyTab() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const { can } = usePermissions();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const [deposit, setDeposit] = useState('');
  const [bank, setBank] = useState('');
  const [staff, setStaff] = useState('');
  const [notes, setNotes] = useState('');

  const dailyQuery = useQuery({
    queryKey: ['provoz', 'daily', date],
    queryFn: () => apiFetch<{ daily: Daily }>(`/api/provoz/daily/${date}`),
    enabled: allowed,
  });

  useEffect(() => {
    const d = dailyQuery.data?.daily;
    if (!d) {
      setCash('');
      setCard('');
      setDeposit('');
      setBank('');
      setStaff('');
      setNotes('');
      return;
    }
    setCash(centsToKc(d.cashCents));
    setCard(centsToKc(d.cardCents));
    setDeposit(centsToKc(d.depositCents));
    setBank(centsToKc(d.bankCents));
    setStaff(centsToKc(d.staffCents));
    setNotes(d.notes ?? '');
  }, [dailyQuery.data]);

  const saveDaily = useMutation({
    mutationFn: () =>
      apiFetch(`/api/provoz/daily/${date}`, {
        method: 'PUT',
        body: JSON.stringify({
          cashCents: kcToCents(cash),
          cardCents: kcToCents(card),
          depositCents: kcToCents(deposit),
          bankCents: kcToCents(bank),
          staffCents: kcToCents(staff),
          notes: notes || null,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'daily', date] }),
  });

  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const ym = month.split('-');
  const monthQuery = useQuery({
    queryKey: ['provoz', 'month', month],
    queryFn: () => apiFetch<{ dailies: Daily[] }>(`/api/provoz/month/${ym[0]}/${Number(ym[1])}`),
    enabled: allowed,
  });

  return (
    <div className="space-y-10">
      <section className="space-y-4 border border-black/10 p-4">
        <h2 className="text-lg font-medium">Denní tržby</h2>
        <div>
          <Label>Datum</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="max-w-xs" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Hotovost (Kč)</Label>
            <Input value={cash} onChange={(e) => setCash(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Karta / kasa (Kč)</Label>
            <Input value={card} onChange={(e) => setCard(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Vklad (Kč)</Label>
            <Input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Na účet (Kč)</Label>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} inputMode="decimal" />
          </div>
          <div>
            <Label>Staff (Kč)</Label>
            <Input value={staff} onChange={(e) => setStaff(e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <div>
          <Label>Poznámka</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        {saveDaily.isError && <p className="text-sm text-red-600">{(saveDaily.error as Error).message}</p>}
        <Button type="button" onClick={() => saveDaily.mutate()} disabled={saveDaily.isPending}>
          Uložit den
        </Button>
      </section>

      <section className="space-y-2 border border-black/10 p-4">
        <h2 className="text-lg font-medium">Měsíční přehled</h2>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-xs" />
        <ul className="text-sm max-h-48 overflow-auto space-y-1">
          {(monthQuery.data?.dailies ?? []).map((d) =>
            d ? (
              <li key={d.businessDate}>
                {d.businessDate}: hotově {centsToKc(d.cashCents)} Kč, karta {centsToKc(d.cardCents)} Kč
              </li>
            ) : null
          )}
        </ul>
      </section>

      {can('provoz.receipts') && (
        <section className="space-y-2 border border-black/10 p-4">
          <h2 className="text-lg font-medium">Účtenky / doklady</h2>
          <p className="text-sm text-black/60">Nahrání a focení dokladů je na stránce Účtenky.</p>
          <Button type="button" variant="outline" asChild>
            <Link to="/provoz/uctenky">Otevřít účtenky</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
