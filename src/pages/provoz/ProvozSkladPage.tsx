import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { usePermissions } from '@/lib/usePermissions';

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  qtyOnHand: string;
  minQty: string | null;
  active: boolean;
  sortOrder: number;
};

type StockMovement = {
  id: string;
  inventoryItemId: string;
  kind: string;
  quantityDelta: string;
  source: string;
  note: string | null;
  createdAt: string;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

export default function ProvozSkladPage() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const { can } = usePermissions();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('ks');
  const [qtyOnHand, setQtyOnHand] = useState('0');
  const [minQty, setMinQty] = useState('');
  const [countDraft, setCountDraft] = useState<Record<string, string>>({});
  const [countNote, setCountNote] = useState('');
  const [mode, setMode] = useState<'stock' | 'inventory'>('stock');

  const itemsQuery = useQuery({
    queryKey: ['provoz', 'inventory-items', 'all'],
    queryFn: () => apiFetch<{ items: InventoryItem[] }>('/api/provoz/inventory-items?all=1'),
    enabled: allowed && can('provoz.stock'),
  });

  const movementsQuery = useQuery({
    queryKey: ['provoz', 'stock-movements'],
    queryFn: () => apiFetch<{ movements: StockMovement[] }>('/api/provoz/stock-movements?limit=40'),
    enabled: allowed && can('provoz.stock') && mode === 'stock',
  });

  const createItem = useMutation({
    mutationFn: () =>
      apiFetch('/api/provoz/inventory-items', {
        method: 'POST',
        body: JSON.stringify({
          name,
          unit,
          qtyOnHand: qtyOnHand || '0',
          minQty: minQty || null,
        }),
      }),
    onSuccess: () => {
      setName('');
      setQtyOnHand('0');
      setMinQty('');
      qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: (item: InventoryItem) =>
      apiFetch(`/api/provoz/inventory-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] }),
  });

  const submitCount = useMutation({
    mutationFn: () => {
      const items = itemsQuery.data?.items ?? [];
      const lines = items
        .filter((i) => i.active)
        .map((i) => ({
          inventoryItemId: i.id,
          countedQty: (countDraft[i.id] ?? i.qtyOnHand).trim(),
        }))
        .filter((l) => l.countedQty !== '');
      return apiFetch('/api/provoz/inventory-counts', {
        method: 'POST',
        body: JSON.stringify({ note: countNote || null, lines }),
      });
    },
    onSuccess: () => {
      setCountNote('');
      setCountDraft({});
      setMode('stock');
      qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] });
      qc.invalidateQueries({ queryKey: ['provoz', 'stock-movements'] });
    },
  });

  const items = itemsQuery.data?.items ?? [];
  const nameById = useMemo(() => new Map(items.map((i) => [i.id, i.name])), [items]);

  if (!can('provoz.stock')) {
    return <p className="text-sm text-black/60">Nemáte oprávnění ke skladu.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === 'stock' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('stock')}
        >
          Stav skladu
        </Button>
        <Button
          type="button"
          variant={mode === 'inventory' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setMode('inventory');
            const draft: Record<string, string> = {};
            for (const i of items.filter((x) => x.active)) draft[i.id] = i.qtyOnHand;
            setCountDraft(draft);
          }}
        >
          Inventura
        </Button>
      </div>

      {mode === 'stock' && (
        <>
          <section className="space-y-4 border border-black/10 p-4">
            <h2 className="text-lg font-medium">Nová surovina</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label>Název</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>Jednotka</Label>
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </div>
              <div>
                <Label>Počáteční stav</Label>
                <Input value={qtyOnHand} onChange={(e) => setQtyOnHand(e.target.value)} />
              </div>
              <div>
                <Label>Min. zásoba (volitelné)</Label>
                <Input value={minQty} onChange={(e) => setMinQty(e.target.value)} />
              </div>
            </div>
            {createItem.isError && (
              <p className="text-sm text-red-600">{(createItem.error as Error).message}</p>
            )}
            <Button
              type="button"
              disabled={!name.trim() || !unit.trim() || createItem.isPending}
              onClick={() => createItem.mutate()}
            >
              Přidat surovinu
            </Button>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Suroviny</h2>
            <ul className="divide-y divide-black/10 border border-black/10">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm ${
                    !item.active ? 'opacity-50' : ''
                  }`}
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-black/55">
                      {item.qtyOnHand} {item.unit}
                      {item.minQty ? ` · min. ${item.minQty}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive.mutate(item)}
                  >
                    {item.active ? 'Deaktivovat' : 'Aktivovat'}
                  </Button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="px-3 py-4 text-sm text-black/50">Zatím žádné suroviny.</li>
              )}
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Poslední pohyby</h2>
            <ul className="divide-y divide-black/10 border border-black/10 text-sm">
              {(movementsQuery.data?.movements ?? []).map((m) => (
                <li key={m.id} className="px-3 py-2 flex flex-wrap justify-between gap-2">
                  <span>
                    {nameById.get(m.inventoryItemId) ?? m.inventoryItemId} · {m.kind}{' '}
                    <span className="font-medium">
                      {Number(m.quantityDelta) > 0 ? '+' : ''}
                      {m.quantityDelta}
                    </span>
                  </span>
                  <span className="text-black/50">{formatWhen(m.createdAt)}</span>
                </li>
              ))}
              {(movementsQuery.data?.movements ?? []).length === 0 && (
                <li className="px-3 py-4 text-black/50">Žádné pohyby.</li>
              )}
            </ul>
          </section>
        </>
      )}

      {mode === 'inventory' && (
        <section className="space-y-4 border border-black/10 p-4">
          <h2 className="text-lg font-medium">Inventura po směně</h2>
          <p className="text-sm text-black/60">
            Zadejte skutečné stavy. Rozdíl se zapíše jako korekce skladu.
          </p>
          <div className="space-y-3">
            {items
              .filter((i) => i.active)
              .map((item) => (
                <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_120px] items-end">
                  <div>
                    <Label>
                      {item.name} ({item.unit}) · systém {item.qtyOnHand}
                    </Label>
                  </div>
                  <Input
                    value={countDraft[item.id] ?? item.qtyOnHand}
                    onChange={(e) =>
                      setCountDraft((d) => ({ ...d, [item.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
          </div>
          <div>
            <Label>Poznámka</Label>
            <Input value={countNote} onChange={(e) => setCountNote(e.target.value)} />
          </div>
          {submitCount.isError && (
            <p className="text-sm text-red-600">{(submitCount.error as Error).message}</p>
          )}
          {submitCount.isSuccess && <p className="text-sm text-green-700">Inventura uložena.</p>}
          <Button
            type="button"
            disabled={submitCount.isPending || items.filter((i) => i.active).length === 0}
            onClick={() => submitCount.mutate()}
          >
            Uložit inventuru
          </Button>
        </section>
      )}
    </div>
  );
}
