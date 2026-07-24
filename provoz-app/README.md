# Stage Bistro – provoz (mobilní PWA)

Samostatná appka: **objednávky surovin** + **sken účtenek**. Správa dodavatelů zůstává na webu (`/provoz/dodavatele`). Instalace / QR: web `/provoz/aplikace`.

## Lokálně

```bash
# terminál 1
npm run api:dev

# terminál 2
npm run provoz:dev
```

App: http://localhost:5174 (Vite proxy `/api` → `localhost:3001`)

Seed login (po `npm run api:seed`): viz `ADMIN_EMAIL` / `ADMIN_PASSWORD` v `api/.env` (výchozí `admin@stagebistro.local` / `changeme`).

## Env

| Proměnná | Kde | Účel |
|----------|-----|------|
| `VITE_API_URL` | provoz-app (build) | Veřejná URL API, bez `/` |
| `VITE_PROVOZ_APP_URL` | hlavní Web (build) | Odkaz/QR na `/provoz/aplikace` |

## Railway — checklist

### A) Push kódu
Deploy z `main` (tento repozitář).

### B) API (existující služba)
1. Variables → `MIGRATE_ON_START=true` → **Deploy** (migrace 0008/0009).
2. Do `CORS_ORIGIN` přidej URL nové Provoz služby (čárkou vedle webu), pak restart API.
3. Ověř SMTP (`SMTP_*`, `UCETNI_EMAIL`) a R2 (`R2_*`) — bez toho nejdou maily / upload účtenek.

### C) Nová služba „Provoz“
1. New Service → stejný GitHub repo.
2. **Root Directory:** `provoz-app`
3. Builder: **Dockerfile**
4. Networking → Generate domain (nebo `provoz.stagebistro.cz`)
5. Variables (musí být dostupné při **buildu**):
   - `VITE_API_URL` = veřejná URL API (stejná jako u Web), např. `https://api-….up.railway.app`
6. Deploy. Po změně `VITE_API_URL` vždy **Rebuild**.

### D) Web (existující)
1. Variables → `VITE_PROVOZ_APP_URL` = veřejná URL služby Provoz
2. **Redeploy / Rebuild** Web

### E) Pořadí
API (migrace) → Provoz (`VITE_API_URL`) → API (`CORS_ORIGIN` + Provoz) → Web (`VITE_PROVOZ_APP_URL`)

### F) Test
1. `GET {API}/health` → `{ "ok": true }`
2. Otevřít Provoz URL → login
3. Web `/provoz/aplikace` → QR/odkaz vede na Provoz
4. Objednávka / účtenka (SMTP + R2)

### Příklad CORS_ORIGIN na API
```text
https://www.stagebistro.cz,https://web-production-XXXX.up.railway.app,https://provoz-production-XXXX.up.railway.app
```
