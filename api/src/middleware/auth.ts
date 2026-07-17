import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { getSessionUser, SESSION_COOKIE, type AuthUser } from '../lib/session.js';
import {
  canAccessProvoz,
  canAccessUcetni,
  hasAnyPermission,
  type Permission,
} from '../lib/permissions.js';

export const requireAuth = createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', user);
  await next();
});

/** @deprecated Prefer requirePermission — kept for gradual migration */
export function requireRole(...roles: AuthUser['role'][]) {
  return createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
    const user = c.get('user');
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
}

export function requirePermission(...required: Permission[]) {
  return createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
    const user = c.get('user');
    if (!hasAnyPermission(user.permissions, required)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
}

export function requireProvozAccess() {
  return createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
    const user = c.get('user');
    if (!canAccessProvoz(user.permissions)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
}

export function requireUcetniAccess() {
  return createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
    const user = c.get('user');
    if (!canAccessUcetni(user.permissions)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
}

export { SESSION_COOKIE, getCookie };
