# Docker build obchází Railpack/BuildKit (chyba `secret CORS_ORIGIN: not found`). Railway: Root Directory = `api`.

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . ./
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3001
CMD ["node", "dist/index.js"]
