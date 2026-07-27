import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { usePermissions } from '@/lib/usePermissions';
import { Link } from 'react-router';

type Supplier = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

type SupplierItem = {
  id: string;
  name: string;
  unit: string;
  defaultQty: string | null;
  active: boolean;
};

type LineDraft = {
  selected: boolean;
  quantity: string;
  lineNote: string;
};

type OrderLine = {
  id: string;
  nameSnapshot: string;
  unitSnapshot: string;
  quantity: string;
  lineNote: string | null;
  quantityReceived?: string;
  quantityRemaining?: string;
};

type OpenOrder = {
  id: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  supplier: Supplier | null;
  lines: OrderLine[];
};

type Step = 'suppliers' | 'items' | 'preview' | 'done';
type View = 'new' | 'open' | 'receive';

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

export default function ProvozObjednavkyPage() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const { can } = usePermissions();
  const canSend = can('provoz.orders.send') || can('provoz.orders');
  const canReceive = can('provoz.stock');

  const [view, setView] = useState<View>(canSend ? 'new' : 'open');
  const [step, setStep] = useState<Step>('suppliers');
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, LineDraft>>({});
  const [orderNote, setOrderNote] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ to: string; subject: string; body: string } | null>(
    null
  );
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const [receiveOrderId, setReceiveOrderId] = useState<string | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [receiveChecked, setReceiveChecked] = useState<Record<string, boolean>>({});
  const [receiveNote, setReceiveNote] = useState('');

  const suppliersQuery = useQuery({
    queryKey: ['provoz', 'suppliers'],
    queryFn: () => apiFetch<{ suppliers: Supplier[] }>('/api/provoz/suppliers'),
    enabled: allowed && canSend && view === 'new',
  });

  const itemsQuery = useQuery({
    queryKey: ['provoz', 'supplier-items', supplierId],
    queryFn: () =>
      apiFetch<{ items: SupplierItem[] }>(`/api/provoz/suppliers/${supplierId}/items`),
    enabled: allowed && canSend && Boolean(supplierId) && view === 'new',
  });

  const openOrdersQuery = useQuery({
    queryKey: ['provoz', 'orders', 'open'],
    queryFn: () => apiFetch<{ orders: OpenOrder[] }>('/api/provoz/orders?status=open&limit=50'),
    enabled: allowed && canReceive && (view === 'open' || view === 'receive'),
  });

  const selectedSupplier = useMemo(
    () => (suppliersQuery.data?.suppliers ?? []).find((s) => s.id === supplierId) ?? null,
    [suppliersQuery.data, supplierId]
  );

  const selectedLines = useMemo(() => {
    const items = itemsQuery.data?.items ?? [];
    return items
      .filter((item) => lines[item.id]?.selected)
      .map((item) => ({
        item,
        draft: lines[item.id]!,
      }));
  }, [itemsQuery.data, lines]);

  const receiveOrder = useMemo(
    () => (openOrdersQuery.data?.orders ?? []).find((o) => o.id === receiveOrderId) ?? null,
    [openOrdersQuery.data, receiveOrderId]
  );

  function pickSupplier(id: string) {
    setSupplierId(id);
    setLines({});
    setOrderNote('');
    setStep('items');
  }

  function ensureDraft(item: SupplierItem): LineDraft {
    return (
      lines[item.id] ?? {
        selected: false,
        quantity: item.defaultQty ?? '',
        lineNote: '',
      }
    );
  }

  function updateLine(item: SupplierItem, patch: Partial<LineDraft>) {
    setLines((prev) => ({
      ...prev,
      [item.id]: { ...ensureDraft(item), ...patch },
    }));
  }

  function startReceive(order: OpenOrder) {
    const qtys: Record<string, string> = {};
    const checked: Record<string, boolean> = {};
    for (const line of order.lines) {
      const remaining = line.quantityRemaining ?? line.quantity;
      qtys[line.id] = remaining;
      checked[line.id] = Number(remaining) > 0;
    }
    setReceiveOrderId(order.id);
    setReceiveQtys(qtys);
    setReceiveChecked(checked);
    setReceiveNote('');
    setView('receive');
  }

  const createAndPreview = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error('Vyberte dodavatele');
      for (const row of selectedLines) {
        if (!row.draft.quantity.trim()) {
          throw new Error(`Doplňte množství: ${row.item.name}`);
        }
      }
      const created = await apiFetch<{ order: { id: string } }>('/api/provoz/orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          note: orderNote.trim() || null,
          lines: selectedLines.map((row) => ({
            supplierItemId: row.item.id,
            quantity: row.draft.quantity.trim(),
            lineNote: row.draft.lineNote.trim() || null,
          })),
        }),
      });
      const id = created.order.id;
      setOrderId(id);
      const prev = await apiFetch<{ to: string; subject: string; body: string }>(
        `/api/provoz/orders/${id}/preview`,
        { method: 'POST', body: '{}' }
      );
      setPreview(prev);
      setStep('preview');
    },
  });

  const sendOrder = useMutation({
    mutationFn: async () => {
      if (!orderId) throw new Error('Chybí objednávka');
      return apiFetch<{ emailed: boolean; error?: string }>(`/api/provoz/orders/${orderId}/send`, {
        method: 'POST',
        body: '{}',
      });
    },
    onSuccess: (res) => {
      setResultMsg(
        res.emailed
          ? 'Objednávka odeslána dodavateli e-mailem.'
          : `Odeslání selhalo: ${res.error ?? 'neznámá chyba'}`
      );
      setStep('done');
      qc.invalidateQueries({ queryKey: ['provoz', 'orders'] });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async () => {
      if (!receiveOrderId) throw new Error('Chybí objednávka');
      const linesPayload = Object.entries(receiveChecked)
        .filter(([, on]) => on)
        .map(([orderLineId]) => ({
          orderLineId,
          quantityReceived: (receiveQtys[orderLineId] ?? '').trim(),
        }))
        .filter((l) => l.quantityReceived);
      if (linesPayload.length === 0) throw new Error('Označte alespoň jednu položku');
      return apiFetch(`/api/provoz/orders/${receiveOrderId}/receive`, {
        method: 'POST',
        body: JSON.stringify({ note: receiveNote.trim() || null, lines: linesPayload }),
      });
    },
    onSuccess: () => {
      setView('open');
      setReceiveOrderId(null);
      qc.invalidateQueries({ queryKey: ['provoz', 'orders'] });
      qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] });
    },
  });

  if (!canSend && !canReceive) {
    return <p className="text-sm text-black/60">Nemáte oprávnění k objednávkám.</p>;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-20">
      <div>
        <h2 className="text-xl font-medium tracking-tight">Objednávky</h2>
        <p className="mt-1 text-sm text-black/60">Objednejte suroviny a přijměte závozy na sklad.</p>
        {can('provoz.orders') && (
          <p className="mt-2 text-sm">
            <Link to="/provoz/dodavatele" className="underline underline-offset-2">
              Správa dodavatelů a šablon
            </Link>
          </p>
        )}
      </div>

      <div className="flex gap-2">
        {canSend && (
          <Button
            type="button"
            size="sm"
            variant={view === 'new' ? 'default' : 'outline'}
            onClick={() => setView('new')}
          >
            Nová
          </Button>
        )}
        {canReceive && (
          <Button
            type="button"
            size="sm"
            variant={view === 'open' || view === 'receive' ? 'default' : 'outline'}
            onClick={() => setView('open')}
          >
            Na cestě
          </Button>
        )}
      </div>

      {view === 'open' && canReceive && (
        <section className="space-y-2">
          <ul className="divide-y divide-black/10 border border-black/10">
            {(openOrdersQuery.data?.orders ?? []).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-4 py-4 text-left hover:bg-black/5"
                  onClick={() => startReceive(o)}
                >
                  <span className="font-medium">{o.supplier?.name ?? 'Dodavatel'}</span>
                  <span className="text-xs text-black/50">
                    {o.status} · {formatWhen(o.sentAt ?? o.createdAt)} · {o.lines.length} položek
                  </span>
                </button>
              </li>
            ))}
            {(openOrdersQuery.data?.orders ?? []).length === 0 && (
              <li className="px-4 py-6 text-sm text-black/50">Žádné objednávky na cestě.</li>
            )}
          </ul>
        </section>
      )}

      {view === 'receive' && receiveOrder && (
        <section className="space-y-4">
          <button
            type="button"
            className="text-sm text-black/60 underline underline-offset-2"
            onClick={() => setView('open')}
          >
            ← Zpět
          </button>
          <h3 className="font-medium">{receiveOrder.supplier?.name}</h3>
          <ul className="space-y-3">
            {receiveOrder.lines.map((line) => (
              <li key={line.id} className="border border-black/10 p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={Boolean(receiveChecked[line.id])}
                    onChange={(e) =>
                      setReceiveChecked((c) => ({ ...c, [line.id]: e.target.checked }))
                    }
                  />
                  <span className="flex-1 text-sm">
                    <span className="font-medium">{line.nameSnapshot}</span>
                    <span className="block text-black/50">
                      objednáno {line.quantity} {line.unitSnapshot}
                      {line.quantityReceived
                        ? ` · přijato ${line.quantityReceived} · zbývá ${line.quantityRemaining}`
                        : ''}
                    </span>
                  </span>
                </label>
                {receiveChecked[line.id] && (
                  <div className="mt-2 pl-7">
                    <Label>Dodané množství</Label>
                    <Input
                      value={receiveQtys[line.id] ?? ''}
                      onChange={(e) =>
                        setReceiveQtys((q) => ({ ...q, [line.id]: e.target.value }))
                      }
                      inputMode="decimal"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div>
            <Label>Poznámka k závozu</Label>
            <Textarea rows={2} value={receiveNote} onChange={(e) => setReceiveNote(e.target.value)} />
          </div>
          {receiveMutation.isError && (
            <p className="text-sm text-red-600">{(receiveMutation.error as Error).message}</p>
          )}
          <Button
            type="button"
            className="h-12 w-full"
            disabled={receiveMutation.isPending}
            onClick={() => receiveMutation.mutate()}
          >
            {receiveMutation.isPending ? 'Přijímám…' : 'Přijmout na sklad'}
          </Button>
        </section>
      )}

      {view === 'new' && canSend && (
        <>
          {step === 'suppliers' && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium">Vyberte dodavatele</h3>
              <ul className="divide-y divide-black/10 border border-black/10">
                {(suppliersQuery.data?.suppliers ?? []).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col gap-0.5 px-4 py-4 text-left hover:bg-black/5"
                      onClick={() => pickSupplier(s.id)}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-black/50">{s.email}</span>
                    </button>
                  </li>
                ))}
                {(suppliersQuery.data?.suppliers ?? []).length === 0 && (
                  <li className="px-4 py-6 text-sm text-black/50">
                    Žádní aktivní dodavatelé. Nejdřív je přidejte ve správě.
                  </li>
                )}
              </ul>
            </section>
          )}

          {step === 'items' && selectedSupplier && (
            <section className="space-y-4">
              <button
                type="button"
                className="text-sm text-black/60 underline underline-offset-2"
                onClick={() => setStep('suppliers')}
              >
                ← {selectedSupplier.name}
              </button>

              <ul className="space-y-3">
                {(itemsQuery.data?.items ?? []).map((item) => {
                  const draft = ensureDraft(item);
                  return (
                    <li key={item.id} className="border border-black/10 p-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={draft.selected}
                          onChange={(e) => updateLine(item, { selected: e.target.checked })}
                        />
                        <span className="flex-1">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-black/50"> ({item.unit})</span>
                        </span>
                      </label>
                      {draft.selected && (
                        <div className="mt-3 grid gap-2 pl-7">
                          <div>
                            <Label>Množství</Label>
                            <Input
                              value={draft.quantity}
                              onChange={(e) => updateLine(item, { quantity: e.target.value })}
                              inputMode="decimal"
                            />
                          </div>
                          <div>
                            <Label>Poznámka k položce</Label>
                            <Input
                              value={draft.lineNote}
                              onChange={(e) => updateLine(item, { lineNote: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {(itemsQuery.data?.items ?? []).length === 0 && (
                <p className="text-sm text-black/50">Tento dodavatel nemá aktivní položky.</p>
              )}

              <div>
                <Label>Poznámka k objednávce</Label>
                <Textarea rows={2} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
              </div>

              {createAndPreview.isError && (
                <p className="text-sm text-red-600">{(createAndPreview.error as Error).message}</p>
              )}

              <Button
                type="button"
                className="h-12 w-full"
                disabled={selectedLines.length === 0 || createAndPreview.isPending}
                onClick={() => createAndPreview.mutate()}
              >
                {createAndPreview.isPending ? 'Připravuji…' : 'Náhled e-mailu'}
              </Button>
            </section>
          )}

          {step === 'preview' && preview && (
            <section className="space-y-4">
              <button
                type="button"
                className="text-sm text-black/60 underline underline-offset-2"
                onClick={() => setStep('items')}
              >
                ← Zpět k položkám
              </button>
              <div className="space-y-2 border border-black/10 p-4 text-sm">
                <p>
                  <span className="text-black/50">Komu:</span> {preview.to}
                </p>
                <p>
                  <span className="text-black/50">Předmět:</span> {preview.subject}
                </p>
                <pre className="whitespace-pre-wrap border-t border-black/10 pt-3 font-sans">
                  {preview.body}
                </pre>
              </div>
              {sendOrder.isError && (
                <p className="text-sm text-red-600">{(sendOrder.error as Error).message}</p>
              )}
              <Button
                type="button"
                className="h-12 w-full"
                disabled={sendOrder.isPending}
                onClick={() => sendOrder.mutate()}
              >
                {sendOrder.isPending ? 'Odesílám…' : 'Odeslat dodavateli'}
              </Button>
            </section>
          )}

          {step === 'done' && (
            <section className="space-y-4">
              <p className="text-sm">{resultMsg}</p>
              <Button
                type="button"
                className="h-12 w-full"
                onClick={() => {
                  setStep('suppliers');
                  setSupplierId(null);
                  setLines({});
                  setOrderNote('');
                  setOrderId(null);
                  setPreview(null);
                  setResultMsg(null);
                }}
              >
                Nová objednávka
              </Button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
