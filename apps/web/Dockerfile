# Build context is the repo root — contracts/ needs to sit next to apps/web
# for tsconfig's @contracts/* path. Unlike apps/engine, the runtime image
# needs no contracts/ volume mount: Next's bundler inlines contracts/ into
# .next/standalone at build time, so nothing reads it at runtime.

FROM node:22-alpine AS deps
WORKDIR /app

# contracts/ first, then web's manifest files, so `npm ci` layer-caches
# independently of application source changes.
COPY contracts/ ./contracts/
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
WORKDIR /app/apps/web
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY contracts/ ./contracts/
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web/ ./apps/web/
WORKDIR /app/apps/web
RUN npm run build

FROM node:22-alpine AS runtime
RUN addgroup -S web && adduser -S web -G web
WORKDIR /app

# next.config.ts's output: "standalone" traces just the server + pruned
# node_modules — .next/static and public/ are excluded by design, copied
# in separately below.
COPY --from=build --chown=web:web /app/apps/web/.next/standalone ./
COPY --from=build --chown=web:web /app/apps/web/.next/static ./.next/static
COPY --from=build --chown=web:web /app/apps/web/public ./public

USER web
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
