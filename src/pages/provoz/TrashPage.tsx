import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import type { Worker } from '@/types/staff';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';

export default function TrashPage() {
  const qc = useQueryClient();
  const { allowed } = useProvozAuth();
  const { data } = useQuery({
    queryKey: ['provoz', 'workers', 'trash'],
    queryFn: () => apiFetch<{ workers: Worker[] }>('/api/provoz/workers?deleted=true'),
    enabled: allowed,
  });

  const restore = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/provoz/workers/${id}/restore`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provoz', 'workers'] });
      qc.invalidateQueries({ queryKey: ['provoz', 'workers', 'trash'] });
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Koš</h2>
      <ul className="divide-y border border-black/10 rounded">
        {(data?.workers ?? []).map((w) => (
          <li key={w.id} className="p-3 flex justify-between items-center">
            <span>
              {w.firstName} {w.lastName}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => restore.mutate(w.id)}>
              Obnovit
            </Button>
          </li>
        ))}
        {!data?.workers?.length && <li className="p-4 text-sm text-black/50">Koš je prázdný.</li>}
      </ul>
    </div>
  );
}
