import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getApiBase } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';

import { usePermissions } from '@/lib/usePermissions';
import { defaultPathForUser } from '@/lib/loginRedirect';

type Receipt = {
  id: string;
  category: string;
  status: string;
  amountCents: number | null;
  note: string | null;
  createdAt: string;
  storageKey: string | null;
};

export default function UcetniPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isLoading: meLoading, canAccessUcetni, canAccessAdmin, canAccessProvoz, can } = usePermissions();

  const defaultTab = useMemo(() => {
    if (can('accounting.read')) return 'receipts';
    if (can('accounting.contracts')) return 'contracts';
    if (can('accounting.read')) return 'vpp';
    return 'receipts';
  }, [can]);

  const [tab, setTab] = useState(defaultTab);
  useEffect(() => setTab(defaultTab), [defaultTab]);

  useEffect(() => {
    if (meLoading) return;
    if (!user) navigate('/login', { replace: true });
    else if (!canAccessUcetni) navigate(defaultPathForUser(user.role, user.permissions), { replace: true });
  }, [user, meLoading, navigate, canAccessUcetni]);

  const [status, setStatus] = useState<'all' | 'pending' | 'booked'>('pending');

  const listQuery = useQuery({
    queryKey: ['ucetni', 'receipts', status],
    queryFn: () => {
      const q = status === 'all' ? '' : `?status=${status}`;
      return apiFetch<{ receipts: Receipt[] }>(`/api/ucetni/receipts${q}`);
    },
    enabled: Boolean(user && can('accounting.read')),
  });

  const contractsQuery = useQuery({
    queryKey: ['ucetni', 'contracts'],
    queryFn: () =>
      apiFetch<{
        contracts: {
          workerId: string;
          firstName: string;
          lastName: string;
          position: string;
          contractSource: string | null;
          contractSignedAt: string;
          contractAccountingEmailedAt: string | null;
          contractStart: string | null;
          contractEnd: string | null;
          hourlyRateCents: number;
        }[];
      }>('/api/ucetni/contracts'),
    enabled: Boolean(user && can('accounting.contracts')),
  });

  const markContractSeen = useMutation({
    mutationFn: (workerId: string) =>
      apiFetch(`/api/ucetni/contracts/${workerId}/seen`, { method: 'PATCH', body: '{}' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ucetni', 'contracts'] }),
  });

  const wageQuery = useQuery({
    queryKey: ['ucetni', 'wage-payments'],
    queryFn: () =>
      apiFetch<{
        payments: {
          id: string;
          vppNumber: string;
          paidAt: string;
          amountCents: number;
          workerName: string;
          workedMinutesTotal: number;
        }[];
      }>('/api/ucetni/wage-payments'),
    enabled: Boolean(user && can('accounting.read')),
  });

  const book = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/ucetni/receipts/${id}/book`, { method: 'PATCH', body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ucetni', 'receipts'] }),
  });

  const logout = useMutation({
    mutationFn: () => apiFetch('/api/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/login', { replace: true });
    },
  });

  const downloadCsv = () => {
    const base = getApiBase();
    window.open(`${base}/api/ucetni/export/wage-payments.csv`, '_blank');
  };

  if (meLoading || !user || !canAccessUcetni) {
    return <div className="p-8 text-center text-sm text-black/60">Načítání…</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl tracking-tight">Účetní</h1>
        <div className="flex gap-2">
          {canAccessAdmin && (
            <Button variant="outline" type="button" onClick={() => navigate('/admin')}>
              Admin
            </Button>
          )}
          {canAccessProvoz && (
            <Button variant="outline" type="button" onClick={() => navigate('/provoz')}>
              Provoz
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {can('accounting.read') && <TabsTrigger value="receipts">Účtenky</TabsTrigger>}
          {can('accounting.contracts') && (
          <TabsTrigger value="contracts">
            Smlouvy DPC
            {(contractsQuery.data?.contracts.length ?? 0) > 0 && (
              <span className="ml-1 text-amber-700">({contractsQuery.data?.contracts.length})</span>
            )}
          </TabsTrigger>
          )}
          {can('accounting.read') && <TabsTrigger value="vpp">Výplaty / VPP</TabsTrigger>}
        </TabsList>
        {can('accounting.read') && (
        <TabsContent value="receipts" className="space-y-4 mt-4">
          <div>
            <Label>Stav</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vše</SelectItem>
                <SelectItem value="pending">K zaúčtování</SelectItem>
                <SelectItem value="booked">Zaúčtováno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ul className="space-y-2 text-sm border border-black/10 divide-y">
            {(listQuery.data?.receipts ?? []).map((r) => (
              <li key={r.id} className="p-3 flex flex-wrap justify-between gap-2 items-start">
                <div>
                  <div className="font-medium">
                    {r.category} — {r.status}
                  </div>
                  <div className="text-black/60 text-xs">{new Date(r.createdAt).toLocaleString('cs-CZ')}</div>
                  {r.amountCents != null && <div>{Math.round(r.amountCents / 100)} Kč</div>}
                  {r.note && <div>{r.note}</div>}
                </div>
                {r.status === 'pending' && can('accounting.book') && (
                  <Button size="sm" type="button" onClick={() => book.mutate(r.id)} disabled={book.isPending}>
                    Označit zaúčtováno
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </TabsContent>
        )}
        {can('accounting.contracts') && (
        <TabsContent value="contracts" className="space-y-4 mt-4">
          <p className="text-sm text-black/60">
            Nově aktivované smlouvy (digitální podpis nebo nahraný sken). Po zpracování označte jako zpracováno.
          </p>
          <ul className="space-y-2 text-sm border border-black/10 divide-y">
            {(contractsQuery.data?.contracts ?? []).length === 0 && (
              <li className="p-3 text-black/50">Žádné nové smlouvy k zpracování.</li>
            )}
            {(contractsQuery.data?.contracts ?? []).map((c) => (
              <li key={c.workerId} className="p-3 flex flex-wrap justify-between gap-2 items-start">
                <div>
                  <div className="font-medium">
                    {c.firstName} {c.lastName}
                  </div>
                  <div className="text-black/60 text-xs">
                    {new Date(c.contractSignedAt).toLocaleString('cs-CZ')} · {c.position}
                    {c.contractSource === 'scan' ? ' · sken' : ' · digitální'}
                    {c.contractAccountingEmailedAt ? ' · e-mail doručen' : ' · bez e-mailu'}
                  </div>
                  <div className="text-xs text-black/50">
                    {(c.hourlyRateCents / 100).toFixed(0)} Kč/h
                    {c.contractStart && ` · od ${c.contractStart}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={async () => {
                      const base = getApiBase();
                      const res = await fetch(`${base}/api/ucetni/contracts/${c.workerId}/file`, {
                        credentials: 'include',
                      });
                      if (!res.ok) return;
                      const blob = await res.blob();
                      window.open(URL.createObjectURL(blob), '_blank');
                    }}
                  >
                    Otevřít smlouvu
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => markContractSeen.mutate(c.workerId)}
                    disabled={markContractSeen.isPending}
                  >
                    Zpracováno
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
        )}
        {can('accounting.read') && (
        <TabsContent value="vpp" className="space-y-4 mt-4">
          <Button type="button" variant="outline" onClick={downloadCsv}>
            Export CSV (VPP)
          </Button>
          <ul className="space-y-2 text-sm border border-black/10 divide-y">
            {(wageQuery.data?.payments ?? []).map((p) => (
              <li key={p.id} className="p-3 flex justify-between gap-2">
                <div>
                  <div className="font-medium">{p.vppNumber}</div>
                  <div className="text-black/60 text-xs">
                    {new Date(p.paidAt).toLocaleString('cs-CZ')} — {p.workerName}
                  </div>
                  <div>
                    {(p.amountCents / 100).toFixed(2)} Kč · {(p.workedMinutesTotal / 60).toFixed(2)} h
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={async () => {
                    const { url } = await apiFetch<{ url: string }>(`/api/ucetni/wage-payments/${p.id}/pdf-url`);
                    window.open(url, '_blank');
                  }}
                >
                  PDF
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
