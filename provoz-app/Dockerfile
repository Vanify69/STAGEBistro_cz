# Samostatná PWA Provoz — Railway: nová služba, Root Directory = provoz-app (nebo context z rootu).
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve@14
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["sh", "-c", "exec serve dist -s -l ${PORT:-8080}"]
