import type { WorkerStats } from '@/types/staff';

function kc(cents: number) {
  return (cents / 100).toLocaleString('cs-CZ');
}

export function DpcLimitsBadge({ stats }: { stats: WorkerStats }) {
  const yearPct = Math.min(100, (stats.yearWorkedMinutes / (300 * 60)) * 100);
  const monthPct = Math.min(100, (stats.monthPaidCents / 1_150_000) * 100);
  return (
    <div className="grid sm:grid-cols-2 gap-3 text-sm">
      <div className="border border-black/10 p-3 rounded space-y-1">
        <p className="font-medium">Rok {stats.yearWorkedHours} h / 300 h</p>
        <div className="h-2 bg-black/10 rounded overflow-hidden">
          <div className="h-full bg-black" style={{ width: `${yearPct}%` }} />
        </div>
        {stats.yearBlocked && <p className="text-red-600 text-xs">Limit 300 h dosažen</p>}
      </div>
      <div className="border border-black/10 p-3 rounded space-y-1">
        <p className="font-medium">Měsíc vyplaceno {kc(stats.monthPaidCents)} Kč / 11 500 Kč</p>
        <div className="h-2 bg-black/10 rounded overflow-hidden">
          <div className="h-full bg-amber-600" style={{ width: `${monthPct}%` }} />
        </div>
        <p className="text-black/60 text-xs">Nepřiznáno: {kc(stats.unpaidCents)} Kč</p>
      </div>
    </div>
  );
}
