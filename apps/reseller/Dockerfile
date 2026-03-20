# ---- Stage 1: Dependencies ----
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/reseller/package.json apps/reseller/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/

RUN pnpm install --frozen-lockfile

# ---- Stage 2: Builder ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/reseller/node_modules ./apps/reseller/node_modules
COPY --from=deps /app/packages/ ./packages/

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json tsconfig.json ./
COPY apps/reseller/ apps/reseller/
COPY packages/ packages/

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @wapixia/reseller build

# ---- Stage 3: Runner ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/reseller/public ./apps/reseller/public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/apps/reseller/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/reseller/.next/static ./apps/reseller/.next/static

USER nextjs

EXPOSE 3003

ENV PORT=3003
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/reseller/server.js"]
