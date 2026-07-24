import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { usePermissions } from '@/lib/usePermissions';

type Receipt = {
  id: string;
  category: string;
  status: string;
  storageKey: string | null;
  amountCents: number | null;
  note: string | null;
  accountingEmailedAt: string | null;
  createdAt: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  nafta: 'Nafta',
  suroviny: 'Suroviny',
  ostatni: 'Ostatní',
};

function kcToCents(v: string): number | null {
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('cs-CZ', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ProvozUctenkyPage() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const { can } = usePermissions();
  const fileRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<'nafta' | 'suroviny' | 'ostatni'>('suroviny');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const receiptsQuery = useQuery({
    queryKey: ['provoz', 'receipts'],
    queryFn: () => apiFetch<{ receipts: Receipt[] }>('/api/provoz/receipts'),
    enabled: allowed && can('provoz.receipts'),
  });

  const recent = useMemo(() => {
    const rows = [...(receiptsQuery.data?.receipts ?? [])];
    rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows.slice(0, 20);
  }, [receiptsQuery.data]);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Vyberte nebo vyfoťte doklad');
      const created = await apiFetch<{ receipt: { id: string } }>('/api/provoz/receipts', {
        method: 'POST',
        body: JSON.stringify({
          category,
          businessDate: new Date().toISOString().slice(0, 10),
          amountCents: kcToCents(amount),
          note: note.trim() || null,
        }),
      });
      const id = created.receipt.id;
      const mime = file.type || 'application/octet-stream';
      const presign = await apiFetch<{ uploadUrl: string; storageKey: string; mime: string }>(
        `/api/provoz/receipts/${id}/presign`,
        { method: 'POST', body: JSON.stringify({ mime }) }
      );
      const put = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': mime },
        body: file,
      });
      if (!put.ok) throw new Error('Upload do úložiště selhal');
      const completed = await apiFetch<{
        receipt: Receipt;
        emailed: boolean;
        emailSkipped: string | null;
      }>(`/api/provoz/receipts/${id}/complete`, {
        method: 'PATCH',
        body: JSON.stringify({ storageKey: presign.storageKey, mime }),
      });
      return completed;
    },
    onSuccess: (res) => {
      setFile(null);
      setAmount('');
      setNote('');
      setDoneMsg(
        res.emailed
          ? 'Doklad uložen a odeslán účetní e-mailem.'
          : 'Doklad uložen. E-mail účetní se nepodařilo odeslat (doklad je ve frontě v portálu).'
      );
      qc.invalidateQueries({ queryKey: ['provoz', 'receipts'] });
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  if (!can('provoz.receipts')) {
    return <p className="text-sm text-black/60">Nemáte oprávnění nahrávat účtenky.</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-medium tracking-tight">Účtenky</h2>
          <p className="mt-1 text-sm text-black/60">Vyfoťte doklad — uloží se na web a odešle účetní.</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            setDoneMsg(null);
            setFile(e.target.files?.[0] ?? null);
          }}
        />

        <Button
          type="button"
          className="h-14 w-full text-base"
          onClick={() => fileRef.current?.click()}
        >
          {file ? 'Vybrat jinou fotku' : 'Vyfotit účtenku'}
        </Button>

        {previewUrl && (
          <div className="overflow-hidden border border-black/10 bg-black/[0.02]">
            <img src={previewUrl} alt="Náhled dokladu" className="max-h-72 w-full object-contain" />
          </div>
        )}
        {file && !previewUrl && (
          <p className="text-sm text-black/70">Soubor: {file.name}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Kategorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suroviny">Suroviny</SelectItem>
                <SelectItem value="nafta">Nafta</SelectItem>
                <SelectItem value="ostatni">Ostatní</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Částka (Kč, volitelné)</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>
        </div>

        <div>
          <Label>Poznámka</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Volitelně" />
        </div>

        {upload.isError && (
          <p className="text-sm text-red-600">{(upload.error as Error).message}</p>
        )}
        {doneMsg && <p className="text-sm text-green-800">{doneMsg}</p>}

        <Button
          type="button"
          className="h-12 w-full"
          disabled={!file || upload.isPending}
          onClick={() => upload.mutate()}
        >
          {upload.isPending ? 'Odesílám…' : 'Odeslat doklad'}
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-black/80">Poslední doklady</h3>
        <ul className="divide-y divide-black/10 border border-black/10">
          {recent.length === 0 && (
            <li className="px-3 py-4 text-sm text-black/50">Zatím žádné doklady.</li>
          )}
          {recent.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5 px-3 py-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{CATEGORY_LABELS[r.category] ?? r.category}</span>
                <span className="text-black/50">{formatWhen(r.createdAt)}</span>
              </div>
              <div className="text-xs text-black/60">
                {r.status === 'booked' ? 'Zaúčtováno' : 'Čeká'}
                {r.storageKey ? ' · soubor' : ''}
                {r.accountingEmailedAt ? ' · e-mail odeslán' : r.storageKey ? ' · e-mail neodeslán' : ''}
                {r.note ? ` · ${r.note}` : ''}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
