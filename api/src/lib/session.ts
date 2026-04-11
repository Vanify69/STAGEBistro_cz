import { eq, and, gt } from 'drizzle-orm';
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { getDb } from '../db/index.js';
import { sessions, users } from '../db/schema.js';

export const SESSION_COOKIE = 'stage_session';
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  role: 'admin' | 'provoz' | 'ucetni';
};

export async function getSessionUser(c: Context): Promise<AuthUser | null> {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) return null;
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sid), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, role: row.role };
}

export function setSessionCookie(c: Context, sessionId: string, expiresAt: Date): void {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function createSession(userId: string): Promise<{ sessionId: string; expiresAt: Date }> {
  const db = getDb();
  const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  });
  return { sessionId, expiresAt };
}

export async function destroySession(sessionId: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}
