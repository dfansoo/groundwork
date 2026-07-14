# The build context is the REPO ROOT, not this directory:
#
#   docker build -f apps/backend/Dockerfile -t groundwork-backend .
#
# A Bun workspace only resolves from the root, so the image has to install from
# there. Everything below keeps the repo's own layout (/repo/apps/backend), which
# is what keeps the workspace symlinks in node_modules valid at runtime.

FROM oven/bun:1.3.14-alpine AS base
WORKDIR /repo
# Prisma's query engine is linked against OpenSSL.
RUN apk add --no-cache openssl

# ---------------------------------------------------------------------------
# deps — manifests only, so this layer survives every source-only change.
# ---------------------------------------------------------------------------
FROM base AS deps
# Prisma resolves the datasource URL when it generates. It never connects, so a
# placeholder is enough — and it stays in this stage, out of the final image.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

COPY package.json bun.lock ./
COPY apps/backend/package.json               apps/backend/
COPY apps/web/package.json                   apps/web/
COPY apps/admin/package.json                 apps/admin/
COPY packages/ui/package.json                packages/ui/
COPY packages/api-client/package.json        packages/api-client/
COPY packages/eslint-config/package.json     packages/eslint-config/
COPY packages/typescript-config/package.json packages/typescript-config/
# The backend's postinstall runs `prisma generate`, which needs the schema.
COPY apps/backend/prisma           apps/backend/prisma
COPY apps/backend/prisma.config.ts apps/backend/

RUN bun install --frozen-lockfile

# ---------------------------------------------------------------------------
# prod-deps — what the runner actually ships.
#
# --filter backend matters: a plain root install resolves every workspace, so the
# API image would carry Next.js, React and the whole frontend tree. That is the
# difference between a ~250MB image and a 1.8GB one.
# ---------------------------------------------------------------------------
FROM base AS prod-deps
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

RUN bun install --frozen-lockfile --production --filter backend

# ---------------------------------------------------------------------------
# builder
# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /repo /repo
COPY . .
RUN cd apps/backend && bun run build

# ---------------------------------------------------------------------------
# runner — Node, not Bun: nothing here needs a bundler.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /repo
RUN apk add --no-cache openssl dumb-init

ENV NODE_ENV=production

COPY --from=prod-deps --chown=node:node /repo/node_modules              ./node_modules
COPY --from=prod-deps --chown=node:node /repo/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=prod-deps --chown=node:node /repo/package.json              ./package.json

COPY --from=builder --chown=node:node /repo/apps/backend/dist             ./apps/backend/dist
COPY --from=builder --chown=node:node /repo/apps/backend/prisma           ./apps/backend/prisma
COPY --from=builder --chown=node:node /repo/apps/backend/prisma.config.ts ./apps/backend/prisma.config.ts
COPY --from=builder --chown=node:node /repo/apps/backend/package.json     ./apps/backend/package.json
COPY --from=builder --chown=node:node /repo/apps/backend/entrypoint.sh    ./apps/backend/entrypoint.sh
RUN chmod +x ./apps/backend/entrypoint.sh

# Signing keys are deliberately NOT baked in. A key inside an image layer is a
# key every puller of that image holds, and a rebuild would invalidate every
# live token. Mount them (see docker-compose.yml) or point the *_KEY_PATH vars
# at a secrets mount.
WORKDIR /repo/apps/backend
# Prisma shells out to `tsx` to run the seed, and resolves it from PATH — which
# does not include node_modules/.bin unless we say so.
ENV PATH="/repo/apps/backend/node_modules/.bin:/repo/node_modules/.bin:${PATH}"
USER node
EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9000/health || exit 1

ENTRYPOINT ["dumb-init", "--", "./entrypoint.sh"]
