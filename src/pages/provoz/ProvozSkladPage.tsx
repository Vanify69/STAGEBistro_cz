import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { usePermissions } from '@/lib/usePermissions';

type InventoryCategory = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  qtyOnHand: string;
  minQty: string | null;
  categoryId: string | null;
  categoryName: string | null;
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
  const [categoryId, setCategoryId] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [countDraft, setCountDraft] = useState<Record<string, string>>({});
  const [countNote, setCountNote] = useState('');
  const [mode, setMode] = useState<'stock' | 'inventory'>('stock');
  const [filterCat, setFilterCat] = useState<string>('all');

  const itemsQuery = useQuery({
    queryKey: ['provoz', 'inventory-items', 'all'],
    queryFn: () =>
      apiFetch<{ items: InventoryItem[]; categories: InventoryCategory[] }>(
        '/api/provoz/inventory-items?all=1'
      ),
    enabled: allowed && can('provoz.stock'),
  });

  const movementsQuery = useQuery({
    queryKey: ['provoz', 'stock-movements'],
    queryFn: () => apiFetch<{ movements: StockMovement[] }>('/api/provoz/stock-movements?limit=40'),
    enabled: allowed && can('provoz.stock') && mode === 'stock',
  });

  const categories = itemsQuery.data?.categories ?? [];
  const items = itemsQuery.data?.items ?? [];

  const createItem = useMutation({
    mutationFn: () =>
      apiFetch('/api/provoz/inventory-items', {
        method: 'POST',
        body: JSON.stringify({
          name,
          unit,
          qtyOnHand: qtyOnHand || '0',
          minQty: minQty || null,
          categoryId: categoryId || null,
        }),
      }),
    onSuccess: () => {
      setName('');
      setQtyOnHand('0');
      setMinQty('');
      qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] });
    },
  });

  const createCategory = useMutation({
    mutationFn: () =>
      apiFetch('/api/provoz/inventory-categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim() }),
      }),
    onSuccess: () => {
      setNewCatName('');
      qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] });
    },
  });

  const setItemCategory = useMutation({
    mutationFn: (payload: { id: string; categoryId: string | null }) =>
      apiFetch(`/api/provoz/inventory-items/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ categoryId: payload.categoryId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] }),
  });

  const toggleActive = useMutation({
    mutationFn: (item: InventoryItem) =>
      apiFetch(`/api/provoz/inventory-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] }),
  });

  const syncFromSuppliers = useMutation({
    mutationFn: () =>
      apiFetch<{ created: number; linked: number; reused: number; skipped: number }>(
        '/api/provoz/inventory-items/sync-from-suppliers',
        { method: 'POST', body: '{}' }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provoz', 'inventory-items'] });
      qc.invalidateQueries({ queryKey: ['provoz', 'supplier-items'] });
    },
  });

  const submitCount = useMutation({
    mutationFn: () => {
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

  const nameById = useMemo(() => new Map(items.map((i) => [i.id, i.name])), [items]);

  const filteredItems = useMemo(() => {
    if (filterCat === 'all') return items;
    if (filterCat === 'none') return items.filter((i) => !i.categoryId);
    return items.filter((i) => i.categoryId === filterCat);
  }, [items, filterCat]);

  const groupedForCount = useMemo(() => {
    const active = items.filter((i) => i.active);
    const map = new Map<string, { title: string; sort: number; items: InventoryItem[] }>();
    for (const item of active) {
      const key = item.categoryId ?? 'none';
      const title = item.categoryName ?? 'Bez kategorie';
      const sort = categories.find((c) => c.id === item.categoryId)?.sortOrder ?? 999;
      const bucket = map.get(key) ?? { title, sort, items: [] };
      bucket.items.push(item);
      map.set(key, bucket);
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort || a.title.localeCompare(b.title, 'cs'));
  }, [items, categories]);

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
          <section className="space-y-3 border border-black/10 p-4">
            <h2 className="text-lg font-medium">Ze položek dodavatelů</h2>
            <p className="text-sm text-black/60">
              Vytvoří suroviny s množstvím 0 (kategorie Ostatní) a propojí je. Poté je můžete
              roztřídit a inventurou nastavit stavy.
            </p>
            {syncFromSuppliers.isError && (
              <p className="text-sm text-red-600">{(syncFromSuppliers.error as Error).message}</p>
            )}
            {syncFromSuppliers.data && (
              <p className="text-sm text-green-700">
                Hotovo: +{syncFromSuppliers.data.created} nových, {syncFromSuppliers.data.linked}{' '}
                propojeno
                {syncFromSuppliers.data.skipped
                  ? `, ${syncFromSuppliers.data.skipped} už bylo napojených`
                  : ''}
                .
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={syncFromSuppliers.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Vytvořit / propojit suroviny podle všech položek dodavatelů (stav 0)?'
                  )
                ) {
                  syncFromSuppliers.mutate();
                }
              }}
            >
              {syncFromSuppliers.isPending ? 'Synchronizuji…' : 'Vytvořit ze položek dodavatelů'}
            </Button>
          </section>

          <section className="space-y-3 border border-black/10 p-4">
            <h2 className="text-lg font-medium">Kategorie skladu</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {categories.map((c) => (
                <li key={c.id} className="border border-black/10 px-2 py-1">
                  {c.name}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[180px]">
                <Label>Nová kategorie</Label>
                <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!newCatName.trim() || createCategory.isPending}
                onClick={() => createCategory.mutate()}
              >
                Přidat
              </Button>
            </div>
          </section>

          <section className="space-y-4 border border-black/10 p-4">
            <h2 className="text-lg font-medium">Nová surovina</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-2">
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
                <Label>Kategorie</Label>
                <select
                  className="h-9 w-full rounded-md border border-black/15 bg-white px-2 text-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Ostatní (výchozí)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Min. zásoba</Label>
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
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">Suroviny</h2>
              <select
                className="h-8 rounded-md border border-black/15 bg-white px-2 text-sm"
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value)}
              >
                <option value="all">Všechny kategorie</option>
                <option value="none">Bez kategorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <ul className="divide-y divide-black/10 border border-black/10">
              {filteredItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-wrap items-center justify-between gap-2 px-3 py-3 text-sm ${
                    !item.active ? 'opacity-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-black/55">
                      {item.qtyOnHand} {item.unit}
                      {item.minQty ? ` · min. ${item.minQty}` : ''}
                      {item.categoryName ? ` · ${item.categoryName}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      className="h-8 rounded-md border border-black/15 bg-white px-2 text-xs"
                      value={item.categoryId ?? ''}
                      onChange={(e) =>
                        setItemCategory.mutate({
                          id: item.id,
                          categoryId: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Bez kategorie</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive.mutate(item)}
                    >
                      {item.active ? 'Deaktivovat' : 'Aktivovat'}
                    </Button>
                  </div>
                </li>
              ))}
              {filteredItems.length === 0 && (
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
            Zadejte skutečné stavy podle kategorií. Rozdíl se zapíše jako korekce skladu.
          </p>
          {groupedForCount.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-sm font-medium border-b border-black/10 pb-1">{group.title}</h3>
              {group.items.map((item) => (
                <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_120px] items-end">
                  <Label>
                    {item.name} ({item.unit}) · systém {item.qtyOnHand}
                  </Label>
                  <Input
                    value={countDraft[item.id] ?? item.qtyOnHand}
                    onChange={(e) =>
                      setCountDraft((d) => ({ ...d, [item.id]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          ))}
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
