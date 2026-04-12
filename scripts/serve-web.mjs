/**
 * Produkční servírování `dist/` (Railway nastaví PORT; lokálně výchozí 5173).
 * Nepoužíváme `npx serve` — v kontejneru může npx padat na síti/registry a pak nic neposlouchá na PORTu.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT ?? '5173';
const serveMain = path.join(root, 'node_modules', 'serve', 'build', 'main.js');
const listen = `tcp://0.0.0.0:${port}`;

const child = spawn(process.execPath, [serveMain, 'dist', '-s', '-l', listen], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
