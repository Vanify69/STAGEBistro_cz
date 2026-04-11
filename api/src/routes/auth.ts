import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { users } from '../db/schema.js';
import {
  getSessionUser,
  createSession,
  setSessionCookie,
  clearSessionCookie,
  destroySession,
  SESSION_COOKIE,
} from '../lib/session.js';
import { getCookie } from 'hono/cookie';

export const authRouter = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid body' }, 400);
  }
  const { email, password } = parsed.data;
  const db = getDb();
  const emailNorm = email.trim().toLowerCase();
  const found = await db.select().from(users).where(eq(users.email, emailNorm)).limit(1);
  const user = found[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  const { sessionId, expiresAt } = await createSession(user.id);
  setSessionCookie(c, sessionId, expiresAt);
  return c.json({
    user: { id: user.id, email: user.email, role: user.role },
  });
});

authRouter.post('/logout', async (c) => {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) {
    await destroySession(sid).catch(() => undefined);
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRouter.get('/me', async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ user: null });
  }
  return c.json({ user });
});
