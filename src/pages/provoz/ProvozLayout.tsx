import { NavLink, Outlet, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { usePermissions } from '@/lib/usePermissions';
import { filterProvozNav } from '@/lib/provozNav';
import { cn } from '@/app/components/ui/utils';

export default function ProvozLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLoading, allowed } = useProvozAuth();
  const { can, canAccessAdmin, permissions } = usePermissions();

  const links = filterProvozNav(permissions);

  const logout = useMutation({
    mutationFn: () => apiFetch('/api/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate('/login', { replace: true });
    },
  });

  if (isLoading || !allowed) {
    return <div className="p-8 text-center text-sm text-black/60">Načítání…</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2 max-w-5xl mx-auto">
        <h1 className="text-xl tracking-tight font-medium">Provoz</h1>
        <div className="flex flex-wrap gap-2">
          {can('staff.attendance') && (
            <Button variant="outline" size="sm" type="button" onClick={() => navigate('/dochazka')}>
              Docházka
            </Button>
          )}
          {canAccessAdmin && (
            <Button variant="outline" size="sm" type="button" onClick={() => navigate('/admin')}>
              Admin
            </Button>
          )}
          <Button variant="outline" size="sm" type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            Odhlásit
          </Button>
        </div>
      </header>
      {links.length > 0 && (
        <nav className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto border-b border-black/10">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                cn(
                  'px-3 py-2 text-sm whitespace-nowrap border-b-2 -mb-px',
                  isActive ? 'border-black font-medium' : 'border-transparent text-black/60'
                )
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
