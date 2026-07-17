export type UserRole = 'admin' | 'provoz' | 'ucetni';

export const PERMISSIONS = [
  'site.settings',
  'site.menu',
  'site.gallery',
  'site.events',
  'staff.workers',
  'staff.contracts',
  'staff.shifts',
  'staff.attendance',
  'staff.payments',
  'provoz.sales',
  'provoz.receipts',
  'accounting.read',
  'accounting.book',
  'accounting.contracts',
  'users.manage',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'site.settings': 'Web — nastavení (patička, IČO, mapa)',
  'site.menu': 'Web — jídelní lístek',
  'site.gallery': 'Web — galerie',
  'site.events': 'Web — akce v hlavičce',
  'staff.workers': 'Personál — brigádníci',
  'staff.contracts': 'Personál — smlouvy DPC',
  'staff.shifts': 'Personál — plán směn',
  'staff.attendance': 'Personál — potvrzení docházky',
  'staff.payments': 'Personál — výplaty (VPP)',
  'provoz.sales': 'Provoz — denní tržby',
  'provoz.receipts': 'Provoz — účtenky (nahrání)',
  'accounting.read': 'Účetní — přehled',
  'accounting.book': 'Účetní — zaúčtování',
  'accounting.contracts': 'Účetní — smlouvy DPC',
  'users.manage': 'Správa uživatelů',
  'audit.read': 'Historie změn (audit log)',
};

export const ROLE_PERMISSION_TEMPLATES: Record<UserRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  provoz: [
    'staff.workers',
    'staff.contracts',
    'staff.shifts',
    'staff.attendance',
    'staff.payments',
    'provoz.sales',
    'provoz.receipts',
  ],
  ucetni: ['accounting.read', 'accounting.book', 'accounting.contracts'],
};

/** Šablony pro rychlé přiřazení v adminu (mimo základní role). */
export const PERMISSION_PRESETS: { id: string; label: string; permissions: readonly Permission[] }[] = [
  {
    id: 'web-manager',
    label: 'Správce webu',
    permissions: ['site.settings', 'site.menu', 'site.gallery', 'site.events'],
  },
  {
    id: 'shift-planner',
    label: 'Plánování směn a docházka',
    permissions: ['staff.shifts', 'staff.attendance', 'staff.workers'],
  },
  {
    id: 'web-and-shifts',
    label: 'Web + plán směn',
    permissions: [
      'site.settings',
      'site.menu',
      'site.gallery',
      'site.events',
      'staff.shifts',
      'staff.attendance',
      'staff.workers',
    ],
  },
];

export const SITE_PERMISSIONS: readonly Permission[] = [
  'site.settings',
  'site.menu',
  'site.gallery',
  'site.events',
];

export const STAFF_PERMISSIONS: readonly Permission[] = [
  'staff.workers',
  'staff.contracts',
  'staff.shifts',
  'staff.attendance',
  'staff.payments',
];

export const PROVOZ_PERMISSIONS: readonly Permission[] = ['provoz.sales', 'provoz.receipts'];

export const ACCOUNTING_PERMISSIONS: readonly Permission[] = [
  'accounting.read',
  'accounting.book',
  'accounting.contracts',
];

export function parseStoredPermissions(raw: string | null | undefined): Permission[] | null {
  if (raw == null || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const allowed = new Set<string>(PERMISSIONS);
    return parsed.filter((p): p is Permission => typeof p === 'string' && allowed.has(p));
  } catch {
    return null;
  }
}

export function resolveEffectivePermissions(
  role: UserRole,
  stored: string | null | undefined
): Permission[] {
  const explicit = parseStoredPermissions(stored);
  if (explicit) return [...new Set(explicit)];
  return [...ROLE_PERMISSION_TEMPLATES[role]];
}

export function hasPermission(userPermissions: readonly string[], permission: Permission): boolean {
  return userPermissions.includes(permission);
}

export function hasAnyPermission(
  userPermissions: readonly string[],
  required: readonly Permission[]
): boolean {
  if (required.length === 0) return true;
  const set = new Set(userPermissions);
  return required.some((p) => set.has(p));
}

export function canAccessAdmin(userPermissions: readonly string[]): boolean {
  return hasAnyPermission(userPermissions, [
    ...SITE_PERMISSIONS,
    'users.manage',
    'audit.read',
  ]);
}

export function canAccessProvoz(userPermissions: readonly string[]): boolean {
  return hasAnyPermission(userPermissions, [...STAFF_PERMISSIONS, ...PROVOZ_PERMISSIONS]);
}

export function canAccessUcetni(userPermissions: readonly string[]): boolean {
  return hasAnyPermission(userPermissions, [...ACCOUNTING_PERMISSIONS]);
}

export function defaultPathForUser(
  role: UserRole,
  permissions: readonly string[]
): string {
  if (canAccessAdmin(permissions)) return '/admin';
  if (canAccessProvoz(permissions)) return '/provoz';
  if (canAccessUcetni(permissions)) return '/ucetni';
  return role === 'admin' ? '/admin' : role === 'provoz' ? '/provoz' : '/ucetni';
}
