import type { Permission } from '@/lib/permissions';
import { hasAnyPermission, hasPermission } from '@/lib/permissions';

export type ProvozNavItem = {
  to: string;
  label: string;
  /** Jedno nebo více oprávnění (stačí jedno). */
  permissions: Permission[];
};

export const PROVOZ_NAV: ProvozNavItem[] = [
  { to: '/provoz/trzby', label: 'Tržby', permissions: ['provoz.sales'] },
  {
    to: '/provoz/zamestnanci',
    label: 'Zaměstnanci',
    permissions: ['staff.workers', 'staff.shifts', 'staff.attendance', 'staff.contracts', 'staff.payments'],
  },
  { to: '/provoz/plan', label: 'Plán směn', permissions: ['staff.shifts'] },
  { to: '/provoz/kos', label: 'Koš', permissions: ['staff.workers'] },
];

export const PROVOZ_ROUTE_PERMISSIONS: Record<string, Permission[]> = {
  '/provoz/trzby': ['provoz.sales'],
  '/provoz/zamestnanci': ['staff.workers', 'staff.shifts', 'staff.attendance', 'staff.contracts', 'staff.payments'],
  '/provoz/plan': ['staff.shifts'],
  '/provoz/kos': ['staff.workers'],
};

export function filterProvozNav(userPermissions: readonly string[]): ProvozNavItem[] {
  return PROVOZ_NAV.filter((item) => hasAnyPermission(userPermissions, item.permissions));
}

export function firstProvozPath(userPermissions: readonly string[]): string | null {
  const nav = filterProvozNav(userPermissions);
  return nav[0]?.to ?? null;
}

export function canAccessProvozPath(path: string, userPermissions: readonly string[]): boolean {
  if (path.startsWith('/provoz/zamestnanci/')) {
    return hasAnyPermission(userPermissions, PROVOZ_ROUTE_PERMISSIONS['/provoz/zamestnanci']!);
  }
  const base = Object.keys(PROVOZ_ROUTE_PERMISSIONS).find((p) => path === p || path.startsWith(`${p}/`));
  if (!base) return true;
  return hasAnyPermission(userPermissions, PROVOZ_ROUTE_PERMISSIONS[base]!);
}

export function canManageWorkers(userPermissions: readonly string[]): boolean {
  return hasPermission(userPermissions, 'staff.workers');
}
