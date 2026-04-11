import { createMiddleware } from 'hono/factory';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PUBLIC = 120;

function keyFor(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('cf-connecting-ip') ?? 'local';
}

export const publicRateLimit = createMiddleware(async (c, next) => {
  const k = keyFor(c);
  const now = Date.now();
  let b = buckets.get(k);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(k, b);
  }
  b.count += 1;
  if (b.count > MAX_PUBLIC) {
    return c.json({ error: 'Too many requests' }, 429);
  }
  await next();
});
