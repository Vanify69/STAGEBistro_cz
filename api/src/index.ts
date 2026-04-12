import './loadEnv.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
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

const corsOriginsRaw =
  process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()).filter(Boolean) ?? ['http://localhost:5173'];
const corsOriginKeys = new Set(corsOriginsRaw.map(originKey));

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return corsOriginsRaw[0];
      if (corsOriginKeys.has(originKey(origin))) return origin;
      return null;
    },
    allowHeaders: ['Content-Type', 'Accept', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

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
