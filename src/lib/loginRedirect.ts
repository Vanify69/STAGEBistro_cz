export function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

export function defaultPathForRole(role: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'provoz') return '/provoz';
  return '/ucetni';
}

export function loginPathFor(target: string): string {
  return `/login?next=${encodeURIComponent(target)}`;
}

export function provozPathOrLogin(target: string, isProvoz: boolean): string {
  return isProvoz ? target : loginPathFor(target);
}
