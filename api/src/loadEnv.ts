import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** Adresář `api/` (kde leží `.env`), funguje z `src/` i z `dist/`. */
const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(apiDir, '.env') });
