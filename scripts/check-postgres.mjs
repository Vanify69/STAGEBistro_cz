import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (process.env.SKIP_DB_PREFLIGHT === '1' || process.env.SKIP_DB_PREFLIGHT === 'true') {
  process.exit(0);
}

function readDatabaseUrlFromApiEnv() {
  const envPath = path.join(root, 'api', '.env');
  if (!fs.existsSync(envPath)) return process.env.DATABASE_URL ?? null;
  const raw = fs.readFileSync(envPath, 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  if (!line) return process.env.DATABASE_URL ?? null;
  let v = line.slice('DATABASE_URL='.length).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim() || process.env.DATABASE_URL || null;
}

function parsePgHostPort(urlStr) {
  try {
    const u = new URL(urlStr.replace(/^postgresql:/i, 'http:'));
    return {
      host: u.hostname || '127.0.0.1',
      port: u.port ? Number(u.port) : 5432,
    };
  } catch {
    return null;
  }
}

function pingTcp(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const dbUrl = readDatabaseUrlFromApiEnv();
if (!dbUrl) {
  console.warn('[preflight] No DATABASE_URL in api/.env — přeskočeno.');
  process.exit(0);
}

const loc = parsePgHostPort(dbUrl);
if (!loc) {
  console.warn('[preflight] Nelze parsovat DATABASE_URL — přeskočeno.');
  process.exit(0);
}

// Na Railway / CI obvykle není lokální host — nekontrolujeme
const h = loc.host.toLowerCase();
const isProbablyLocalDocker = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(h);
if (!isProbablyLocalDocker) {
  process.exit(0);
}

const ok = await pingTcp(loc.host === 'localhost' ? '127.0.0.1' : loc.host, loc.port, 2500);

if (!ok) {
  console.error('');
  console.error('─────────────────────────────────────────────────────────────');
  console.error('[preflight] Postgres na', `${loc.host}:${loc.port}`, 'neodpovídá.');
  console.error('            API bez DB vrátí HTTP 500 (menu / veřejná data).');
  console.error('');
  console.error('  1. Spusť Docker Desktop (Windows)');
  console.error('  2. V kořeni repozitáře:  npm run db:up');
  console.error('  3. Pak znovu:            npm run all');
  console.error('');
  console.error('  Přeskok kontroly:        SKIP_DB_PREFLIGHT=1 npm run all');
  console.error('─────────────────────────────────────────────────────────────');
  console.error('');
  process.exit(1);
}

process.exit(0);
