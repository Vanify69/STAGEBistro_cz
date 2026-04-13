import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/** Adresář `api/` (kde leží `.env`), funguje z `src/` i z `dist/`. */
const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Na Railway už má `process.env` hodnoty z dashboardu — soubor `.env` v kontejneru
 * typicky není; kdyby tam byl (např. chybný COPY), nesmí přepsat runtime proměnné.
 * `override: false` je výchozí chování dotenv; explicitně pro jistotu.
 */
if (!process.env.RAILWAY_ENVIRONMENT) {
  dotenv.config({ path: path.join(apiDir, '.env'), override: false });
}
// Na Railway (`RAILWAY_ENVIRONMENT` nastavené platformou) bereme proměnné jen z dashboardu —
// soubor `.env` se do runtime image typicky nedostane; kdyby ano, nechceme riskovat přepsání CORS.
