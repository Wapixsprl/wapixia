# ---- Stage 1: Builder ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy package.json files for all packages (for dependency resolution)
COPY packages/api/package.json packages/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/queue/package.json packages/queue/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY turbo.json tsconfig.json ./

# Build the API
RUN pnpm --filter @wapixia/api build

# ---- Stage 2: Runner ----
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace config for production install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/api/package.json packages/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/queue/package.json packages/queue/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built output
COPY --from=builder /app/packages/api/dist packages/api/dist
COPY --from=builder /app/packages/db/dist packages/db/dist
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/queue/dist packages/queue/dist

EXPOSE 3010

CMD ["node", "packages/api/dist/server.js"]
