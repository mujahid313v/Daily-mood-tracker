# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Daily Mood Tracker — production image
#
# Multi-stage build:
#   deps    → installs the exact dependency tree from package-lock.json
#   builder → generates the Prisma client and builds the Next.js app
#   runner  → copies only the standalone server output and runs as non-root
#
# No secret is ever baked into an image layer: `.env` is excluded by
# `.dockerignore` and every variable is supplied at runtime.
# ---------------------------------------------------------------------------

FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci


FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma only needs a syntactically valid URL to generate the client; the
# real credentials are injected at runtime.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build \
 && rm -f .next/standalone/.env .next/standalone/.env.*


FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --create-home nextjs

# The standalone bundle ships its own minimal node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "server.js"]
