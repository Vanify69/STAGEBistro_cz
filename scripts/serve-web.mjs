/**
 * Produkční servírování `dist/` (Railway nastaví PORT; lokálně výchozí 5173).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PORT ?? '5173';

const child = spawn('npx', ['serve', 'dist', '-s', '-l', String(port)], {
  stdio: 'inherit',
  cwd: root,
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
