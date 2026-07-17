export type Permission =
  | 'site.settings'
  | 'site.menu'
  | 'site.gallery'
  | 'site.events'
  | 'staff.workers'
  | 'staff.contracts'
  | 'staff.shifts'
  | 'staff.attendance'
  | 'staff.payments'
  | 'provoz.sales'
  | 'provoz.receipts'
  | 'accounting.read'
  | 'accounting.book'
  | 'accounting.contracts'
  | 'users.manage'
  | 'audit.read';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'admin' | 'provoz' | 'ucetni';
  permissions: Permission[];
};

export type MeResponse = { user: AuthUser | null };

const SITE: Permission[] = ['site.settings', 'site.menu', 'site.gallery', 'site.events'];
const STAFF: Permission[] = [
  'staff.workers',
  'staff.contracts',
  'staff.shifts',
  'staff.attendance',
  'staff.payments',
];
const PROVOZ: Permission[] = ['provoz.sales', 'provoz.receipts'];
const ACCOUNTING: Permission[] = ['accounting.read', 'accounting.book', 'accounting.contracts'];

export function hasPermission(permissions: readonly string[], p: Permission): boolean {
  return permissions.includes(p);
}

export function hasAnyPermission(permissions: readonly string[], required: readonly Permission[]): boolean {
  return required.some((p) => permissions.includes(p));
}

export function canAccessAdmin(permissions: readonly string[]): boolean {
  return hasAnyPermission(permissions, [...SITE, 'users.manage', 'audit.read']);
}

export function canAccessProvoz(permissions: readonly string[]): boolean {
  return hasAnyPermission(permissions, [...STAFF, ...PROVOZ]);
}

export function canAccessUcetni(permissions: readonly string[]): boolean {
  return hasAnyPermission(permissions, ACCOUNTING);
}

export function defaultPathForUser(role: string, permissions: readonly string[]): string {
  if (canAccessAdmin(permissions)) return '/admin';
  if (canAccessProvoz(permissions)) return '/provoz';
  if (canAccessUcetni(permissions)) return '/ucetni';
  if (role === 'admin') return '/admin';
  if (role === 'provoz') return '/provoz';
  return '/ucetni';
}
