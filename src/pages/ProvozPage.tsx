import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

type MeResponse = { user: { id: string; email: string; role: string } | null };

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

export default function ProvozPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
  });

  useEffect(() => {
    if (meLoading) return;
    if (!me?.user) navigate('/login', { replace: true });
    else if (me.user.role === 'ucetni') navigate('/ucetni', { replace: true });
  }, [me, meLoading, navigate]);

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
    enabled: Boolean(me?.user && (me.user.role === 'provoz' || me.user.role === 'admin')),
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
    enabled: Boolean(me?.user && (me.user.role === 'provoz' || me.user.role === 'admin')),
  });

  const receiptsQuery = useQuery({
    queryKey: ['provoz', 'receipts'],
    queryFn: () => apiFetch<{ receipts: { id: string; category: string; status: string; storageKey: string | null }[] }>('/api/provoz/receipts'),
    enabled: Boolean(me?.user && (me.user.role === 'provoz' || me.user.role === 'admin')),
  });

  const [rcat, setRcat] = useState<'nafta' | 'suroviny' | 'ostatni'>('suroviny');
  const [rnote, setRnote] = useState('');
  const [ramount, setRamount] = useState('');
  const [rfile, setRfile] = useState<File | null>(null);

  const uploadReceipt = useMutation({
    mutationFn: async () => {
      const created = await apiFetch<{ receipt: { id: string } }>('/api/provoz/receipts', {
        method: 'POST',
        body: JSON.stringify({
          category: rcat,
          businessDate: date,
          amountCents: ramount ? kcToCents(ramount) : null,
          note: rnote || null,
        }),
      });
      const id = created.receipt.id;
      if (!rfile) return { id, skippedUpload: true as const };
      const mime = rfile.type || 'application/octet-stream';
      const presign = await apiFetch<{ uploadUrl: string; storageKey: string; mime: string }>(
        `/api/provoz/receipts/${id}/presign`,
        { method: 'POST', body: JSON.stringify({ mime }) }
      );
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: rfile,
      });
      if (!put.ok) throw new Error('Upload to storage failed');
      await apiFetch(`/api/provoz/receipts/${id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ storageKey: presign.storageKey, mime }),
      });
      return { id };
    },
    onSuccess: () => {
      setRnote('');
      setRamount('');
      setRfile(null);
      qc.invalidateQueries({ queryKey: ['provoz', 'receipts'] });
    },
  });

  const logout = useMutation({
    mutationFn: () => apiFetch('/api/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/login', { replace: true });
    },
  });

  if (meLoading || !me?.user || me.user.role === 'ucetni') {
    return <div className="p-8 text-center text-sm text-black/60">Načítání…</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-3xl mx-auto space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl tracking-tight">Provoz</h1>
        <div className="flex gap-2">
          {me.user.role === 'admin' && (
            <Button variant="outline" type="button" onClick={() => navigate('/admin')}>
              Admin
            </Button>
          )}
          <Button variant="outline" type="button" onClick={() => navigate('/')}>
            Web
          </Button>
          <Button variant="outline" type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Odhlásit
          </Button>
        </div>
      </div>

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

      <section className="space-y-4 border border-black/10 p-4">
        <h2 className="text-lg font-medium">Účtenky / doklady</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Kategorie</Label>
            <Select value={rcat} onValueChange={(v) => setRcat(v as typeof rcat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nafta">Nafta</SelectItem>
                <SelectItem value="suroviny">Suroviny</SelectItem>
                <SelectItem value="ostatni">Ostatní</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Částka (Kč, volitelné)</Label>
            <Input value={ramount} onChange={(e) => setRamount(e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <div>
          <Label>Poznámka</Label>
          <Input value={rnote} onChange={(e) => setRnote(e.target.value)} />
        </div>
        <div>
          <Label>Foto / PDF</Label>
          <Input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={(e) => setRfile(e.target.files?.[0] ?? null)}
          />
        </div>
        {uploadReceipt.isError && <p className="text-sm text-red-600">{(uploadReceipt.error as Error).message}</p>}
        <Button type="button" onClick={() => uploadReceipt.mutate()} disabled={uploadReceipt.isPending}>
          Nahrát doklad
        </Button>
        <ul className="text-xs text-black/70 space-y-1 max-h-40 overflow-auto">
          {(receiptsQuery.data?.receipts ?? []).map((r) => (
            <li key={r.id}>
              {r.id.slice(0, 8)}… {r.category} — {r.status}
              {r.storageKey ? ' (soubor)' : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
