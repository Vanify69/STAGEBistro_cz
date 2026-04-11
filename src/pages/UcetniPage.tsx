import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

type MeResponse = { user: { id: string; email: string; role: string } | null };

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
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/auth/me'),
  });

  useEffect(() => {
    if (meLoading) return;
    if (!me?.user) navigate('/login', { replace: true });
    else if (me.user.role === 'provoz') navigate('/provoz', { replace: true });
  }, [me, meLoading, navigate]);

  const [status, setStatus] = useState<'all' | 'pending' | 'booked'>('pending');

  const listQuery = useQuery({
    queryKey: ['ucetni', 'receipts', status],
    queryFn: () => {
      const q = status === 'all' ? '' : `?status=${status}`;
      return apiFetch<{ receipts: Receipt[] }>(`/api/ucetni/receipts${q}`);
    },
    enabled: Boolean(me?.user && (me.user.role === 'ucetni' || me.user.role === 'admin')),
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

  if (meLoading || !me?.user || me.user.role === 'provoz') {
    return <div className="p-8 text-center text-sm text-black/60">Načítání…</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl tracking-tight">Účetní — doklady</h1>
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

      <div className="flex gap-4 items-end">
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
              {r.storageKey && <div className="text-xs break-all">{r.storageKey}</div>}
            </div>
            {r.status === 'pending' && (
              <Button size="sm" type="button" onClick={() => book.mutate(r.id)} disabled={book.isPending}>
                Označit zaúčtováno
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
