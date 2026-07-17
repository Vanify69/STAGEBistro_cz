import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

type AuditEntry = {
  id: string;
  userEmail: string;
  userDisplayName: string | null;
  action: string;
  summary: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

export function AuditAdminTab() {
  const auditQ = useQuery({
    queryKey: ['admin', 'audit-log'],
    queryFn: () => apiFetch<{ entries: AuditEntry[] }>('/api/admin/audit-log?limit=200'),
  });

  return (
    <div className="space-y-4 mt-4">
      <p className="text-sm text-black/60">Kdo pod jakým účtem provedl změnu v systému (posledních 200 záznamů).</p>
      <div className="border border-black/10 rounded divide-y text-sm max-h-[32rem] overflow-auto">
        {(auditQ.data?.entries ?? []).map((e) => (
          <div key={e.id} className="p-3">
            <p className="text-xs text-black/50">{new Date(e.createdAt).toLocaleString('cs-CZ')}</p>
            <p className="font-medium">
              {e.userDisplayName ? `${e.userDisplayName} · ` : ''}
              {e.userEmail}
            </p>
            <p>{e.summary}</p>
            <p className="text-xs text-black/45 mt-1">{e.action}</p>
          </div>
        ))}
        {auditQ.isLoading && <p className="p-3 text-black/50">Načítání…</p>}
        {!auditQ.isLoading && (auditQ.data?.entries.length ?? 0) === 0 && (
          <p className="p-3 text-black/50">Zatím žádné záznamy.</p>
        )}
      </div>
    </div>
  );
}
