import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { getSessionUser, SESSION_COOKIE, type AuthUser } from '../lib/session.js';

export const requireAuth = createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('user', user);
  await next();
});

export function requireRole(...roles: AuthUser['role'][]) {
  return createMiddleware<{ Variables: { user: AuthUser } }>(async (c, next) => {
    const user = c.get('user');
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  });
}

export { SESSION_COOKIE, getCookie };
