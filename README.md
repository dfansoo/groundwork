<div align="center">

# groundwork

**A fullstack boilerplate that already works.**
Next.js web + admin console, NestJS API, in a Turborepo monorepo.
Auth, RBAC, audit logging, file uploads and transactional email are done — there is no domain code to delete, just one example feature to copy.

[![CI](https://github.com/dfansoo/groundwork/actions/workflows/ci.yml/badge.svg)](https://github.com/dfansoo/groundwork/actions/workflows/ci.yml)

<br />

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS_11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=for-the-badge&logo=turborepo&logoColor=white)](https://turbo.build/)
[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn/ui-000000?style=for-the-badge&logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

```bash
gh repo create my-app --template dfansoo/groundwork --private --clone
```

## Stack

| | |
|---|---|
| <img src="https://cdn.simpleicons.org/turborepo/EF4444" width="16" height="16" align="center" /> **Monorepo** | Turborepo 2.9, Bun workspaces |
| <img src="https://cdn.simpleicons.org/nextdotjs/000000/FFFFFF" width="16" height="16" align="center" /> **Web / Admin** | Next.js 16, React 19, Tailwind v4, shadcn (`base-maia`, Base UI), TanStack Query |
| <img src="https://cdn.simpleicons.org/nestjs/E0234E" width="16" height="16" align="center" /> **API** | NestJS 11, Prisma 7, PostgreSQL |
| <img src="https://cdn.simpleicons.org/auth0/EB5424" width="16" height="16" align="center" /> **Auth** | NestJS issues ES256 JWTs; NextAuth v5 is a session shim |
| <img src="https://cdn.simpleicons.org/vitest/6E9F18" width="16" height="16" align="center" /> **Tests** | Vitest (web/admin), Jest (backend), Playwright (e2e, against the real API) |

## What's already built

- **Auth** — email/password + Google OAuth, ES256 JWTs, refresh rotation, session listing and revocation, password reset
- **RBAC** — five roles, seven permissions, enforced by guards on every route, not merely hidden in the UI
- **Audit log** — every mutation recorded against the acting user, with a CSV export
- **File uploads** — presigned uploads, an orphan sweep, and a disk driver, so you need **no AWS account to run it**
- **Transactional email** — Handlebars templates; renders to the server log in dev, Brevo in prod
- **Typed API client** — generated from the backend's OpenAPI contract, so frontend types *cannot* drift from the API
- **Tests that mean something** — e2e runs against the real backend and database, not a mock

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
