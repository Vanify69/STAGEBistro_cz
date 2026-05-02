import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const example = path.join(root, 'api', '.env.example');
const target = path.join(root, 'api', '.env');

if (!fs.existsSync(example)) {
  console.warn('Missing api/.env.example');
  process.exit(0);
}

if (!fs.existsSync(target)) {
  fs.copyFileSync(example, target);
  console.log('Created api/.env from api/.env.example (Docker Postgres na 127.0.0.1:5433).');
} else {
  // quiet when already present
}
