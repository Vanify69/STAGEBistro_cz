import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { usePermissions } from '@/lib/usePermissions';

type Supplier = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  note: string | null;
  active: boolean;
  sortOrder: number;
};

type SupplierItem = {
  id: string;
  supplierId: string;
  name: string;
  unit: string;
  defaultQty: string | null;
  note: string | null;
  active: boolean;
  sortOrder: number;
};

type OrderTemplate = {
  id: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
};

type OrderRow = {
  id: string;
  status: string;
  note: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  supplier: Supplier | null;
  lines: {
    id: string;
    nameSnapshot: string;
    unitSnapshot: string;
    quantity: string;
    lineNote: string | null;
  }[];
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

export default function ProvozDodavatelePage() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const { can } = usePermissions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');

  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('ks');
  const [itemDefaultQty, setItemDefaultQty] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('ks');
  const [editDefaultQty, setEditDefaultQty] = useState('');

  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const suppliersQuery = useQuery({
    queryKey: ['provoz', 'suppliers', 'all'],
    queryFn: () => apiFetch<{ suppliers: Supplier[] }>('/api/provoz/suppliers?all=1'),
    enabled: allowed && can('provoz.orders'),
  });

  const itemsQuery = useQuery({
    queryKey: ['provoz', 'supplier-items', selectedId],
    queryFn: () =>
      apiFetch<{ items: SupplierItem[] }>(`/api/provoz/suppliers/${selectedId}/items?all=1`),
    enabled: allowed && can('provoz.orders') && Boolean(selectedId),
  });

  const templateQuery = useQuery({
    queryKey: ['provoz', 'order-template'],
    queryFn: () => apiFetch<{ template: OrderTemplate }>('/api/provoz/order-template'),
    enabled: allowed && can('provoz.orders'),
  });

  const ordersQuery = useQuery({
    queryKey: ['provoz', 'orders'],
    queryFn: () => apiFetch<{ orders: OrderRow[] }>('/api/provoz/orders?limit=40'),
    enabled: allowed && can('provoz.orders'),
  });

  useEffect(() => {
    const t = templateQuery.data?.template;
    if (!t) return;
    setSubjectTemplate(t.subjectTemplate);
    setBodyTemplate(t.bodyTemplate);
  }, [templateQuery.data]);

  useEffect(() => {
    const list = suppliersQuery.data?.suppliers ?? [];
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [suppliersQuery.data, selectedId]);

  useEffect(() => {
    setEditingItemId(null);
  }, [selectedId]);

  const createSupplier = useMutation({
    mutationFn: () =>
      apiFetch<{ supplier: Supplier }>('/api/provoz/suppliers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
          note: note || null,
        }),
      }),
    onSuccess: (res) => {
      setName('');
      setEmail('');
      setPhone('');
      setNote('');
      setSelectedId(res.supplier.id);
      qc.invalidateQueries({ queryKey: ['provoz', 'suppliers'] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: (s: Supplier) =>
      apiFetch(`/api/provoz/suppliers/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !s.active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'suppliers'] }),
  });

  const createItem = useMutation({
    mutationFn: () =>
      apiFetch(`/api/provoz/suppliers/${selectedId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          name: itemName,
          unit: itemUnit,
          defaultQty: itemDefaultQty || null,
        }),
      }),
    onSuccess: () => {
      setItemName('');
      setItemDefaultQty('');
      qc.invalidateQueries({ queryKey: ['provoz', 'supplier-items', selectedId] });
    },
  });

  const toggleItem = useMutation({
    mutationFn: (item: SupplierItem) =>
      apiFetch(`/api/provoz/supplier-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !item.active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'supplier-items', selectedId] }),
  });

  const updateItem = useMutation({
    mutationFn: (payload: { id: string; name: string; unit: string; defaultQty: string }) =>
      apiFetch(`/api/provoz/supplier-items/${payload.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: payload.name,
          unit: payload.unit,
          defaultQty: payload.defaultQty || null,
        }),
      }),
    onSuccess: () => {
      setEditingItemId(null);
      qc.invalidateQueries({ queryKey: ['provoz', 'supplier-items', selectedId] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: (item: SupplierItem) =>
      apiFetch(`/api/provoz/supplier-items/${item.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setEditingItemId(null);
      qc.invalidateQueries({ queryKey: ['provoz', 'supplier-items', selectedId] });
    },
  });

  function startEditItem(item: SupplierItem) {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditUnit(item.unit);
    setEditDefaultQty(item.defaultQty ?? '');
  }

  const saveTemplate = useMutation({
    mutationFn: () =>
      apiFetch('/api/provoz/order-template', {
        method: 'PUT',
        body: JSON.stringify({ subjectTemplate, bodyTemplate }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'order-template'] }),
  });

  if (!can('provoz.orders')) {
    return <p className="text-sm text-black/60">Nemáte oprávnění spravovat dodavatele.</p>;
  }

  const suppliers = suppliersQuery.data?.suppliers ?? [];
  const selected = suppliers.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-10">
      <section className="space-y-4 border border-black/10 p-4">
        <h2 className="text-lg font-medium">Nový dodavatel</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Název</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Poznámka</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        {createSupplier.isError && (
          <p className="text-sm text-red-600">{(createSupplier.error as Error).message}</p>
        )}
        <Button
          type="button"
          disabled={!name.trim() || !email.trim() || createSupplier.isPending}
          onClick={() => createSupplier.mutate()}
        >
          Přidat dodavatele
        </Button>
      </section>

      <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Dodavatelé</h2>
          <ul className="divide-y divide-black/10 border border-black/10">
            {suppliers.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2 text-left text-sm ${
                    selectedId === s.id ? 'bg-black text-white' : 'hover:bg-black/5'
                  } ${!s.active ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedId(s.id)}
                >
                  {s.name}
                </button>
              </li>
            ))}
            {suppliers.length === 0 && (
              <li className="px-3 py-4 text-sm text-black/50">Zatím žádní dodavatelé.</li>
            )}
          </ul>
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border border-black/10 p-4">
                <div>
                  <h3 className="font-medium">{selected.name}</h3>
                  <p className="text-sm text-black/60">{selected.email}</p>
                  {selected.phone && <p className="text-sm text-black/60">{selected.phone}</p>}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive.mutate(selected)}
                >
                  {selected.active ? 'Deaktivovat' : 'Aktivovat'}
                </Button>
              </div>

              <div className="space-y-3 border border-black/10 p-4">
                <h3 className="font-medium">Položky k objednání</h3>
                <div className="grid gap-2 sm:grid-cols-4">
                  <Input
                    placeholder="Název"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                  />
                  <Input
                    placeholder="Jednotka"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                  />
                  <Input
                    placeholder="Výchozí množství"
                    value={itemDefaultQty}
                    onChange={(e) => setItemDefaultQty(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={!itemName.trim() || createItem.isPending}
                    onClick={() => createItem.mutate()}
                  >
                    Přidat
                  </Button>
                </div>
                <ul className="divide-y divide-black/10 text-sm">
                  {(itemsQuery.data?.items ?? []).map((item) => (
                    <li key={item.id} className="space-y-2 py-2">
                      {editingItemId === item.id ? (
                        <div className="grid gap-2 sm:grid-cols-4">
                          <Input
                            placeholder="Název"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                          <Input
                            placeholder="Jednotka"
                            value={editUnit}
                            onChange={(e) => setEditUnit(e.target.value)}
                          />
                          <Input
                            placeholder="Výchozí množství"
                            value={editDefaultQty}
                            onChange={(e) => setEditDefaultQty(e.target.value)}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={!editName.trim() || !editUnit.trim() || updateItem.isPending}
                              onClick={() =>
                                updateItem.mutate({
                                  id: item.id,
                                  name: editName.trim(),
                                  unit: editUnit.trim(),
                                  defaultQty: editDefaultQty.trim(),
                                })
                              }
                            >
                              Uložit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingItemId(null)}
                            >
                              Zrušit
                            </Button>
                          </div>
                          {updateItem.isError && (
                            <p className="text-sm text-red-600 sm:col-span-4">
                              {(updateItem.error as Error).message}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={!item.active ? 'opacity-50' : ''}>
                            {item.name}{' '}
                            <span className="text-black/50">
                              ({item.unit}
                              {item.defaultQty ? `, výchozí ${item.defaultQty}` : ''})
                            </span>
                          </span>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => startEditItem(item)}
                            >
                              Upravit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleItem.mutate(item)}
                            >
                              {item.active ? 'Vypnout' : 'Zapnout'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={deleteItem.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Smazat položku „${item.name}“? V historii objednávek zůstane zachována.`
                                  )
                                ) {
                                  deleteItem.mutate(item);
                                }
                              }}
                            >
                              Smazat
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {deleteItem.isError && (
                  <p className="text-sm text-red-600">{(deleteItem.error as Error).message}</p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-black/50">Vyberte dodavatele.</p>
          )}
        </div>
      </section>

      <section className="space-y-3 border border-black/10 p-4">
        <h2 className="text-lg font-medium">Šablona e-mailu</h2>
        <p className="text-xs text-black/50">
          Placeholdery: {'{{datum}}'}, {'{{dodavatel}}'}, {'{{polozky}}'}, {'{{poznamka}}'},{' '}
          {'{{odeslal}}'}
        </p>
        <div>
          <Label>Předmět</Label>
          <Input value={subjectTemplate} onChange={(e) => setSubjectTemplate(e.target.value)} />
        </div>
        <div>
          <Label>Tělo</Label>
          <Textarea
            rows={10}
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            className="font-mono text-sm"
          />
        </div>
        {saveTemplate.isError && (
          <p className="text-sm text-red-600">{(saveTemplate.error as Error).message}</p>
        )}
        {saveTemplate.isSuccess && <p className="text-sm text-green-800">Šablona uložena.</p>}
        <Button type="button" onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending}>
          Uložit šablonu
        </Button>
      </section>

      <section className="space-y-3 border border-black/10 p-4">
        <h2 className="text-lg font-medium">Historie objednávek</h2>
        <ul className="divide-y divide-black/10">
          {(ordersQuery.data?.orders ?? []).map((o) => (
            <li key={o.id} className="py-3 text-sm">
              <button
                type="button"
                className="flex w-full flex-wrap items-baseline justify-between gap-2 text-left"
                onClick={() => setExpandedOrderId((id) => (id === o.id ? null : o.id))}
              >
                <span className="font-medium">
                  {o.supplier?.name ?? 'Dodavatel'} — {o.status}
                </span>
                <span className="text-black/50">{formatWhen(o.sentAt ?? o.createdAt)}</span>
              </button>
              {expandedOrderId === o.id && (
                <div className="mt-2 space-y-1 whitespace-pre-wrap text-black/70">
                  {(o.lines ?? []).map((l) => (
                    <div key={l.id}>
                      • {l.nameSnapshot} — {l.quantity} {l.unitSnapshot}
                      {l.lineNote ? ` (${l.lineNote})` : ''}
                    </div>
                  ))}
                  {o.note && <p>Poznámka: {o.note}</p>}
                  {o.errorMessage && <p className="text-red-600">{o.errorMessage}</p>}
                  {o.emailBody && (
                    <pre className="mt-2 overflow-auto border border-black/10 bg-black/[0.02] p-2 text-xs">
                      {o.emailSubject}
                      {'\n\n'}
                      {o.emailBody}
                    </pre>
                  )}
                </div>
              )}
            </li>
          ))}
          {(ordersQuery.data?.orders ?? []).length === 0 && (
            <li className="py-2 text-black/50">Zatím žádné objednávky.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
