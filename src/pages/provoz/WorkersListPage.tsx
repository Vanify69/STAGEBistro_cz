import { Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import type { Worker } from '@/types/staff';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { canManageWorkers } from '@/lib/provozNav';
import { usePermissions } from '@/lib/usePermissions';

export default function WorkersListPage() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const { permissions } = usePermissions();
  const canCreate = canManageWorkers(permissions);
  const { data, isLoading } = useQuery({
    queryKey: ['provoz', 'workers'],
    queryFn: () => apiFetch<{ workers: Worker[] }>('/api/provoz/workers'),
    enabled: allowed,
  });

  const createBlank = useMutation({
    mutationFn: () =>
      apiFetch<{ worker: Worker }>('/api/provoz/workers', {
        method: 'POST',
        body: JSON.stringify({
          firstName: 'Nový',
          lastName: 'Brigádník',
          position: 'Barista',
          hourlyRateCents: 18000,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['provoz', 'workers'] }),
  });

  if (isLoading) return <p className="text-sm text-black/60">Načítání…</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-lg font-medium">Zaměstnanci (DPC)</h2>
        {canCreate && (
          <Button type="button" onClick={() => createBlank.mutate()} disabled={createBlank.isPending}>
            Nový zaměstnanec
          </Button>
        )}
      </div>
      <ul className="divide-y border border-black/10 rounded">
        {(data?.workers ?? []).map((w) => (
          <li key={w.id} className="p-3 flex justify-between items-center gap-2 hover:bg-black/[0.02]">
            <Link to={`/provoz/zamestnanci/${w.id}`} className="flex-1 min-w-0">
              <p className="font-medium">
                {w.firstName} {w.lastName}
              </p>
              <p className="text-xs text-black/60">
                {w.position} · {(w.hourlyRateCents / 100).toFixed(0)} Kč/h ·{' '}
                <span className="capitalize">{w.status}</span>
              </p>
            </Link>
          </li>
        ))}
        {!data?.workers?.length && <li className="p-4 text-sm text-black/50">Zatím žádní zaměstnanci.</li>}
      </ul>
    </div>
  );
}
