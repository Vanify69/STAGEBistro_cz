import { NavLink, Outlet, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { Button } from '@/app/components/ui/button';
import { useProvozAuth } from '@/pages/provoz/useProvozAuth';
import { usePermissions } from '@/lib/usePermissions';
import { filterProvozNav, type ProvozNavItem } from '@/lib/provozNav';
import { hasAnyPermission } from '@/lib/permissions';
import { cn } from '@/app/components/ui/utils';

const MOBILE_BOTTOM_NAV: ProvozNavItem[] = [
  { to: '/provoz/objednavky', label: 'Objednávky', permissions: ['provoz.orders.send', 'provoz.orders'] },
  { to: '/provoz/uctenky', label: 'Účtenky', permissions: ['provoz.receipts'] },
  { to: '/provoz/trzby', label: 'Tržby', permissions: ['provoz.sales'] },
  {
    to: '/provoz/aplikace',
    label: 'Aplikace',
    permissions: [
      'provoz.sales',
      'provoz.receipts',
      'provoz.orders',
      'provoz.orders.send',
      'staff.workers',
      'staff.shifts',
      'staff.attendance',
      'staff.contracts',
      'staff.payments',
    ],
  },
];

export default function ProvozLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isLoading, allowed } = useProvozAuth();
  const { can, canAccessAdmin, permissions } = usePermissions();

  const links = filterProvozNav(permissions);
  const bottomLinks = MOBILE_BOTTOM_NAV.filter((item) =>
    hasAnyPermission(permissions, item.permissions)
  );

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
        <h1 className="text-xl tracking-tight font-medium">Stage Bistro – provoz</h1>
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
        <nav className="hidden md:flex max-w-5xl mx-auto px-4 gap-1 overflow-x-auto border-b border-black/10">
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
      <main className="max-w-5xl mx-auto p-4 md:p-6 pb-24 md:pb-6">
        <Outlet />
      </main>
      {bottomLinks.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white md:hidden">
          <div className="mx-auto flex max-w-lg">
            {bottomLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'flex-1 py-3 text-center text-sm',
                    isActive ? 'font-medium text-black' : 'text-black/50'
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
