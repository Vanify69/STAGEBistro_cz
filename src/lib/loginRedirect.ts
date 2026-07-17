import { defaultPathForUser } from '@/lib/permissions';

export function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

/** @deprecated use defaultPathForUser with permissions */
export function defaultPathForRole(role: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'provoz') return '/provoz';
  return '/ucetni';
}

export { defaultPathForUser };

export function loginPathFor(target: string): string {
  return `/login?next=${encodeURIComponent(target)}`;
}

export function provozPathOrLogin(target: string, canProvoz: boolean): string {
  return canProvoz ? target : loginPathFor(target);
}
