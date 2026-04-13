import './loadEnv.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { publicRouter } from './routes/public.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { provozRouter } from './routes/provoz.js';
import { ucetniRouter } from './routes/ucetni.js';

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));

/** Srovnání originů (Railway často bez lomítka, v proměnné ho někdo přidá). */
function originKey(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function stripEnvValue(s: string): string {
  return s.replace(/^\uFEFF/, '').trim();
}

function isRailwayWebOrigin(origin: string): boolean {
  return /^https:\/\/web-production-[a-z0-9-]+\.up\.railway\.app$/i.test(originKey(origin));
}

/**
 * Jedna řádka originů (čárkou oddělené) z proměnné prostředí.
 * Podporuje více názvů — když je `CORS_ORIGIN` na špatné službě, často je aspoň hostname jinde.
 */
function getCorsOriginsEnvRaw(): string | undefined {
  const keys = [
    'CORS_ORIGIN',
    'CORS_ORIGINS',
    'ALLOWED_ORIGINS',
    'FRONTEND_ORIGIN',
    'WEB_ORIGIN',
  ] as const;
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && stripEnvValue(String(v))) {
      return stripEnvValue(String(v));
    }
  }
  const domain =
    process.env.WEB_PUBLIC_DOMAIN?.trim() ||
    process.env.FRONTEND_PUBLIC_DOMAIN?.trim();
  if (domain) {
    const host = stripEnvValue(domain.replace(/^https?:\/\//i, '').replace(/\/+$/, ''));
    if (host) return `https://${host}`;
  }
  return undefined;
}

/** Načte CORS bezpečně (prázdný string / jen čárky → localhost výchozí). */
function parseCorsOrigins(): string[] {
  const raw = getCorsOriginsEnvRaw();
  if (raw == null || !raw) {
    return ['http://localhost:5173'];
  }
  const list = raw
    .split(',')
    .map((s) => stripEnvValue(s))
    .filter(Boolean);
  return list.length > 0 ? list : ['http://localhost:5173'];
}

const corsOriginsRaw = parseCorsOrigins();
const corsOriginKeys = new Set(corsOriginsRaw.map(originKey));
const isRailwayFallbackMode =
  !!process.env.RAILWAY_ENVIRONMENT &&
  corsOriginsRaw.length === 1 &&
  corsOriginsRaw[0] === 'http://localhost:5173';

if (process.env.RAILWAY_ENVIRONMENT) {
  const raw = getCorsOriginsEnvRaw();
  const onlyLocalhost =
    corsOriginsRaw.length === 1 && corsOriginsRaw[0]?.startsWith('http://localhost');

  if (raw === undefined) {
    console.warn(
      '[cors] Žádná z proměnných pro origin (CORS_ORIGIN, WEB_ORIGIN, …) v tomto procesu není nastavená. Railway → vyber službu API (ne Web) → Variables → přidej CORS_ORIGIN = přesná URL webu (https://web-production-….up.railway.app) → Deploy.'
    );
  } else if (!raw) {
    console.warn('[cors] CORS proměnná je prázdná — doplň URL webu včetně https://');
  } else if (/xxxx/i.test(raw)) {
    console.warn(
      '[cors] Hodnota obsahuje „xxxx“ — v README je to zástupný znak. Použij skutečnou doménu z Networking u služby Web.'
    );
  }

  if (onlyLocalhost) {
    const related = Object.keys(process.env).filter((k) =>
      /CORS|ORIGIN|FRONTEND|WEB_PUBLIC/i.test(k)
    );
    console.warn(
      '[cors] POZOR: povolen je jen výchozí localhost — prohlížeč z Railway webu dostane CORS chybu. ' +
        'Ověř, že proměnná je u služby, která spouští tento log (API), ne u Web. ' +
        `Nalezené klíče prostředí s „CORS/ORIGIN/…“: ${related.length ? related.join(', ') : '(žádné)'}.`
    );
    console.warn(
      '[cors] Dočasný fallback aktivní: povolím origin ve tvaru https://web-production-*.up.railway.app, dokud Railway nepředává CORS_ORIGIN do runtime.'
    );
  }
}
console.log('[cors] povolené originy:', corsOriginsRaw.join(' | '));

/**
 * Vlastní CORS: vestavěné `hono/cors` u některých verzí nastaví Allow-Origin před `next()`,
 * ale `c.json()` pak pošle odpověď bez těch hlaviček → prohlížeč: „No Access-Control-Allow-Origin“.
 */
const CORS_ALLOW_HEADERS = 'Content-Type, Accept, Authorization';
const CORS_ALLOW_METHODS = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS';

const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('Origin');
  const byConfig = origin && corsOriginKeys.has(originKey(origin)) ? origin : undefined;
  const byRailwayFallback =
    origin && isRailwayFallbackMode && isRailwayWebOrigin(origin) ? origin : undefined;
  const allowed = byConfig ?? byRailwayFallback;

  if (c.req.method === 'OPTIONS') {
    if (allowed) {
      c.header('Access-Control-Allow-Origin', allowed);
      c.header('Access-Control-Allow-Credentials', 'true');
      c.header('Access-Control-Allow-Methods', CORS_ALLOW_METHODS);
      const reqHeaders = c.req.header('Access-Control-Request-Headers');
      c.header('Access-Control-Allow-Headers', reqHeaders ?? CORS_ALLOW_HEADERS);
      c.header('Access-Control-Max-Age', '86400');
      c.header('Vary', 'Origin');
    }
    return c.body(null, 204);
  }

  await next();

  if (allowed) {
    c.header('Access-Control-Allow-Origin', allowed);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin');
  }
};

app.use('*', corsMiddleware);

app.route('/api/public', publicRouter);
app.route('/api/auth', authRouter);
app.route('/api/admin', adminRouter);
app.route('/api/provoz', provozRouter);
app.route('/api/ucetni', ucetniRouter);

async function runMigrationsIfEnabled(): Promise<void> {
  if (process.env.MIGRATE_ON_START !== 'true' && process.env.MIGRATE_ON_START !== '1') return;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('MIGRATE_ON_START requires DATABASE_URL');
  }
  const migrationClient = postgres(url, { max: 1 });
  const d = drizzle(migrationClient);
  // Relativně k `api/dist/` — funguje i když `cwd` je kořen monorepa (Railway / npm z rootu).
  const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');
  await migrate(d, { migrationsFolder: folder });
  await migrationClient.end({ timeout: 5 });
}

const port = Number(process.env.PORT ?? '3001');

runMigrationsIfEnabled()
  .then(() => {
    serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
    console.log(`API listening on http://0.0.0.0:${port}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
