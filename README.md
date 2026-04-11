# Stage Bistro — web, administrace, provoz

Monorepo: **Vite + React** (veřejný web, `/admin`, `/provoz`, `/ucetni`) a **Node API** (`api/`, Hono + Drizzle + PostgreSQL). Lokálně API běží na portu `3001`, Vite na `5173` a přes proxy přeposílá `/api`.

## Požadavky

- Node 20+
- PostgreSQL 16+ (lokálně nebo Railway plugin)

## Lokální rozjezd

### Proč padalo `DATABASE_URL is required`

Při `npm run all` běží proces z **kořene monorepa** — obyčejné `dotenv` načítalo `.env` z kořene, ne z `api/.env`. To je opravené: proměnné se berou z **`api/.env`**. Příkaz `npm run all` navíc jednorázově vytvoří `api/.env` zkopírováním z [`api/.env.example`](api/.env.example), pokud soubor ještě neexistuje.

### Kroky

1. **PostgreSQL** — buď vlastní instance, nebo Docker (potřebuješ nainstalovaný Docker Desktop):

```bash
npm run db:up
```

Výchozí přihlašovací údaje v `api/.env.example` odpovídají tomu kontejneru (`postgres` / `postgres`, DB `stagebistro`). Kontejner je z hostu na portu **`5433`** (`5433:5432`), aby nekolidoval s případnou vlastní instalací Postgresu na `:5432`.

2. **Migrace** (z kořene repozitáře)

```bash
npm run api:migrate
```

3. **Seed** (admin + menu + galerie + nastavení)

```bash
npm run api:seed
```

Výchozí přihlášení: viz `ADMIN_EMAIL` / `ADMIN_PASSWORD` v `api/.env` (po prvním spuštění `npm run all` nebo `npm run api:env`).

4. **API + web**

```bash
npm run all
```

Spustí API (`:3001`) i Vite (`:5173`) v jednom terminálu (prefixy `api` / `web`). Samostatně: `npm run api:dev` nebo `npm run dev`.

Postgres vypnout: `npm run db:down`.

Veřejná data: `GET http://localhost:3001/api/public/site` (z prohlížeče přes proxy `http://localhost:5173/api/public/site`).

## Struktura API (zkratka)

| Prefix | Popis |
|--------|--------|
| `GET /health` | Health check |
| `GET /api/public/site` | Veřejný agregát (nastavení, menu, galerie, akce v hlavičce pro „dnes“ v Europe/Prague) |
| `POST /api/auth/login` | Cookie session |
| `POST /api/auth/logout` | |
| `GET /api/auth/me` | |
| `GET/PATCH /api/admin/*` | Pouze role `admin` |
| `GET/PUT /api/provoz/*` | `admin` nebo `provoz` (denní tržby, doklady, presigned upload) |
| `GET/PATCH /api/ucetni/*` | `admin` nebo `ucetni` |

Účtenky: `POST /api/provoz/receipts` → `POST /api/provoz/receipts/:id/presign` → nahrát soubor PUT na vrácenou URL → `PATCH /api/provoz/receipts/:id/complete`. Vyžaduje nakonfigurované **R2** (nebo jiný S3 endpoint) v env.

## Railway

Doporučené **dvě služby** + **PostgreSQL**:

1. **API** — root `api`, build `npm install && npm run build`, start `npm run start`, working directory `api`. Proměnné: `DATABASE_URL`, `PORT` (Railway doplní), `SESSION_SECRET`, `CORS_ORIGIN` (URL webové služby, např. `https://web-production-xxxx.up.railway.app`), `MIGRATE_ON_START=true` pro první deploy, poté lze vypnout. Volitelně R2 proměnné.

2. **Web** — root repozitáře, build `npm install && npm run build`, start `npm run start` (statický `serve` s SPA fallbackem). Nastavte `VITE_API_URL` na veřejnou URL API **před** buildem (build-time proměnná).

3. Po nasazení spusťte jednorázově seed (Railway „Run Command“ nebo lokálně s produkčním `DATABASE_URL`): `npm run api:seed`.

## Skripty (kořen)

| Skript | Účel |
|--------|------|
| `npm run db:up` / `db:down` | Docker Postgres (viz `docker-compose.yml`) |
| `npm run api:env` | Vytvoří `api/.env` z příkladu, pokud chybí |
| `npm run all` | API + Vite paralelně (doporučeno pro lokál) |
| `npm run dev` | Jen Vite |
| `npm run build` | Produkční build webu do `dist/` |
| `npm run start` | Statické hostování `dist/` (pro Railway web) |
| `npm run api:dev` | API s `tsx watch` |
| `npm run api:build` | `tsc` do `api/dist/` |
| `npm run api:start` | Produkční `node api/dist/index.js` |
| `npm run api:seed` | Seed DB |
| `npm run api:migrate` | Drizzle migrace |

## Licence / design

Původní návrh ve Figma viz odkaz v historickém README projektu; kód v repozitáři je upravený pro provozní nasazení.
