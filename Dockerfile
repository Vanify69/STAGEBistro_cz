# Web (Vite) — `dist/` je v .gitignore; tím se dostane do runtime image vždy po buildu.
# Railway: služba Web, root repozitáře (prázdný Root Directory). API dál používá api/Dockerfile.

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["sh", "-c", "exec node node_modules/serve/build/main.js dist -s -l ${PORT:-8080}"]
