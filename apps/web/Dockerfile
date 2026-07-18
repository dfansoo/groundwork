# The build context is the REPO ROOT, not this directory:
#
#   docker build -f apps/web/Dockerfile -t groundwork-web .
#
# A Bun workspace only resolves from the root, so the image installs from there.

FROM oven/bun:1.3.14-alpine AS base
WORKDIR /repo

# ---------------------------------------------------------------------------
# deps — manifests only, so this layer survives every source-only change.
# ---------------------------------------------------------------------------
FROM base AS deps
# The backend's postinstall runs `prisma generate` even when we are only building
# a frontend, because a workspace install runs every workspace's hooks. It needs
# the schema and a resolvable URL; it never connects, and neither reaches the
# final image.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

COPY package.json bun.lock ./
COPY apps/backend/package.json               apps/backend/
COPY apps/web/package.json                   apps/web/
COPY apps/admin/package.json                 apps/admin/
COPY packages/ui/package.json                packages/ui/
COPY packages/api-client/package.json        packages/api-client/
COPY packages/eslint-config/package.json     packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY apps/backend/prisma           apps/backend/prisma
COPY apps/backend/prisma.config.ts apps/backend/

RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /repo /repo
COPY . .

# The typed client is generated from the committed openapi.json, so the frontend
# image never has to build the backend to get its types.
RUN cd packages/api-client && bun run generate
RUN cd apps/web && bun run build

# ---------------------------------------------------------------------------
# runner — Node, not Bun: `next build --output standalone` emits a plain server.
# ---------------------------------------------------------------------------
FROM node:26-alpine AS runner
WORKDIR /repo

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# outputFileTracingRoot is the repo root, so the standalone tree is laid out as
# apps/web/server.js + node_modules + the traced workspace packages.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static     ./apps/web/.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
