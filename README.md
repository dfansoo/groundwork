# groundwork

A fullstack boilerplate: **Next.js web + admin console, NestJS API**, in a Turborepo monorepo. Authentication, RBAC, audit logging, file uploads and transactional email already work. There is no domain code to delete — just one example feature to copy.

```bash
gh repo create my-app --template dfansoo/groundwork --private --clone
```

## Stack

| | |
|---|---|
| **Monorepo** | Turborepo 2.9, Bun workspaces |
| **Web / Admin** | Next.js 16, React 19, Tailwind v4, shadcn (`base-maia`, Base UI), TanStack Query |
| **API** | NestJS 11, Prisma 7, PostgreSQL |
| **Auth** | NestJS issues ES256 JWTs; NextAuth v5 is a session shim |
| **Tests** | Vitest (web/admin), Jest (backend), Playwright (e2e, against the real API) |

## Layout

```
apps/
  web/       public client        :3000
  admin/     admin console        :3001
  backend/   API + Prisma         :9000   (Swagger at /doc)
packages/
  ui/                @workspace/ui — shared shadcn components + theme
  api-client/        typed client, generated from the API's OpenAPI contract
  eslint-config/     shared lint config
  typescript-config/ shared tsconfigs
```

## Quick start

You need **Bun 1.3+**, **Node 20+**, and **PostgreSQL** (natively, or `docker compose up -d db` inside `apps/backend`).

```bash
bun install

# 1. Backend
cd apps/backend
cp .env.example .env                       # set DATABASE_URL, and DATA_ENCRYPTION_KEY (openssl rand -base64 32)
bun run keys:generate                      # EC P-256 keypair for signing tokens
bun run db:migrate                         # create the schema
bun run db:seed                            # SUPER_ADMIN + two example items

# 2. Frontends
cd ../web   && cp .env.example .env.local  # set AUTH_SECRET (openssl rand -base64 32)
cd ../admin && cp .env.example .env.local  # set AUTH_SECRET

# 3. Run everything
cd ../.. && bun dev
```

Sign in at <http://localhost:3001> with the seeded admin — `admin@example.com` / `ChangeMe123!` by default (`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `apps/backend/.env`).

**No cloud account is needed.** `FILES_DRIVER=local` writes uploads to disk, and `MAIL_TRANSPORT=log` renders emails into the server log. Switch to `s3` and `brevo` for production.

## Starting a real feature

`items` is the example, threaded end to end so every layer is visible at once:

| Layer | Path |
|---|---|
| API | `apps/backend/src/items/` + the `Item` model in `prisma/schema.prisma` |
| Admin UI | `apps/admin/features/items/` + `app/(dashboard)/items/` |
| Public UI | `apps/web/app/items/` |

Copy those, rename, delete the originals. Between them they demonstrate validated DTOs, a slug derived from the title, RBAC at the controller, an audit-log entry on every mutation, soft deletes, and file attachment.

Adding a resource usually means: a Prisma model → a backend module → a `*_READ` / `*_WRITE` pair in `src/types/permission.enum.ts` (and its mirror in `apps/admin/lib/permissions.ts`) → a nav entry → a `features/` directory.

## Architecture decisions

**The backend is the identity source of truth.** NestJS owns users, password hashing, ES256 JWTs, refresh rotation, session revocation and OAuth provider linking. NextAuth exists in the frontends only to run the Google redirect dance and to hold the backend's tokens in an encrypted cookie. Web, admin, and any future mobile client all authenticate the same way.

*Better Auth was considered and rejected*: it is an auth **server**, so putting it in the frontends would stand a second one in front of the real one, with two session stores that can disagree. The reasoning is in [the design spec](docs/2026-07-14-groundwork-design.md).

**Types cannot drift from the API.** The backend emits `openapi.json`; `@workspace/api-client` generates its types from it. Turbo runs `backend#openapi` before the client builds, so changing a route breaks the frontend build rather than production.

**Permissions are enforced server-side.** `apps/admin/lib/permissions.ts` mirrors the backend's map, but only to decide which nav entries and buttons to render. Every call is authorized by `PermissionsGuard` — a tampered client gets a 403, not access.

## Commands

| | |
|---|---|
| `bun dev` | everything, in parallel |
| `bun run build` | build all (regenerates the API client first) |
| `bun run test` | Vitest + Jest |
| `bunx turbo test:e2e` | Playwright — **needs the backend running and seeded** |
| `bun run lint` · `bun run typecheck` | across the workspace |

Backend-only: `db:migrate`, `db:seed`, `keys:generate`, `openapi`.

## Secrets

`.env*` (except `.env.example`), `keys/` and `storage/` are git-ignored. Nothing secret ships in this template — generate your own with `keys:generate` and `openssl rand -base64 32`.
