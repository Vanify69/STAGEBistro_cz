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

Na canvasu stačí **Postgres + API + Web** (viz propojení Postgres → API přes `DATABASE_URL`). **Web s API se „nepropojí“ čárou v UI** — propojení je přes **proměnné prostředí** a **CORS** níže.

### A) Tabulky v Postgres (migrace)

1. Otevři službu **API** → **Variables**.
2. Ověř, že **`DATABASE_URL`** odkazuje na Postgres (Railway **Reference** na proměnnou z databázové služby).
3. Přidej **`MIGRATE_ON_START`** = `true` (nebo `1`).
4. **Deploy / Restart** API a v **Deploy Logs** zkontroluj, že start proběhl bez chyby (migrace běží před nasloucháním na portu).
5. Volitelně: `MIGRATE_ON_START` zase smaž nebo nastav na `false`, ať se migrace neopakují při každém restartu.

> Pozn.: Složka migrací se bere relativně k `api/dist/` (ne k `process.cwd()`), takže fungují i když službu spouštíš z kořene monorepa.

### B) Propojení Web ↔ API

**`CORS_ORIGIN` dej jen na službu API, ne na Web.** Frontend CORS neřeší; na Web patří **`VITE_API_URL`**. Když `CORS_ORIGIN` přidáš na **Web**, Railpack při `npm run build` často spadne na chybě `secret CORS_ORIGIN: not found` (BuildKit očekuje secret, který u webového buildu nemá být).

1. Zkopíruj **veřejnou URL** služby **API** (Settings → Networking → veřejná doména, tvar `https://….up.railway.app`).
2. Služba **Web** → **Variables** → přidej **`VITE_API_URL`** = přesně ta URL API (bez koncového `/`).  
   **Důležité:** Vite proměnné `VITE_*` se zapisují **při buildu** — po změně musíš u **Web** spustit **nový deploy** (rebuild).
3. Služba **API** → **Variables** → **`CORS_ORIGIN`** = **přesná** veřejná URL **webu** (včetně `https://`). Víc domén odděl čárkou.
4. Po změně `CORS_ORIGIN` znovu **deploy API** (restart).

Kontrola: v prohlížeči `GET …/health` na API → `{ "ok": true }`. Z webu v DevTools → síť: požadavky na `/api/...` jdou na doménu z `VITE_API_URL`.

### C) Data (seed: admin, menu, galerie, nastavení)

Až migrace doběhly a API běží:

- **Railway:** u služby **API** použij **Run** / jednorázový shell (podle aktuálního UI), nebo lokálně z kořene repa s produkčním `DATABASE_URL` v env:

```bash
npm run api:seed
```

Pokud má API služba v Railway **Root Directory** = `api`, spusť tam ekvivalentně **`npm run seed`**.

Přihlášení admina odpovídá **`ADMIN_EMAIL`** / **`ADMIN_PASSWORD`** v proměnných API (nebo výchozím z `api/.env.example`).

### Shrnutí služeb

| Služba | Root (typicky) | Build | Start | Klíčové proměnné |
|--------|----------------|-------|-------|------------------|
| **API** | **`api`** (doporučeno kvůli `api/Dockerfile`) nebo monorepo root | Railpack: `npm install` + `npm run build`; Docker: viz `api/Dockerfile` | `npm start` / `node dist/index.js` | `DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, volitelně `MIGRATE_ON_START`, R2 |
| **Web** | kořen repa | Doporučeno: **`Dockerfile`** v kořeni (explicitní `dist` ve image). Jinak Railpack: `npm install && npm run build`, `npm run start` | `npm run start` nebo CMD z Dockerfile | **`VITE_API_URL`** před buildem — **ne** `CORS_ORIGIN` |

**Railway → Web → Networking:** veřejná doména musí směřovat na **stejný port**, na kterém app naslouchá — typicky proměnná **`PORT`** (často `8080`). Nenastavuj ručně **5173** (to je Vite dev); jinak uvidíš „Application failed to respond“ i při běžícím `serve`.

**Menu / data nenačtená, chyba o `DOCTYPE` / „not valid JSON“:** u služby **Web** musí být **`VITE_API_URL`** = celá `https://…` URL **API**. U **Dockerfile** v kořeni je navíc `ARG VITE_API_URL` / `ENV` v builder stage — Railway proměnnou předá jen do buildu, když je takto deklarovaná; jinak Vite při `npm run build` URL nezapíše do bundlu i když je proměnná v UI. Po změně **redeploy Web** (nový build).

Volitelně R2 proměnné pro nahrávání dokladů — viz `api/.env.example`.

### Chyba `secret CORS_ORIGIN: not found` (Railpack / BuildKit)

Někdy Railpack u Node buildu předává **všechny** proměnné služby jako BuildKit **secrets**; u části projektů pak Docker hlásí `secret CORS_ORIGIN: not found` i při **správně uložené** prosté URL v `CORS_ORIGIN` — jde o chování build pipeline, ne o špatnou hodnotu v UI.

**Spolehlivý obchvat:** u služby **API** použij **Dockerfile** v repu (`api/Dockerfile`):

1. V Railway u služby **API** → **Settings** → **Root Directory** nastav na **`api`** (složka, kde leží `Dockerfile`).
2. Smaž případné vlastní **Build Command** / Railpack overrides, ať Railway zvolí Docker build z tohoto souboru (po pushi repozitáře).
3. **Start Command** nech `npm start` z `package.json` v `api` **nebo** přímo `node dist/index.js` (výsledek je stejný po `Dockerfile` CMD).

Proměnné (`CORS_ORIGIN`, `DATABASE_URL`, …) zůstávají v Railway jako u Railpacku — načítají se při **běhu** kontejneru, neřeší se jako BuildKit secrets při `npm run build`.

Doplňkově (když chceš zůstat u Railpacku): `CORS_ORIGIN` jako prostý text z Networking webu; staged deploy; u pádu ověř, zda log patří službě **API** nebo **Web**; zkus **`NO_CACHE=1`**. Na API v produkci nastav i **`SESSION_SECRET`**.

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
