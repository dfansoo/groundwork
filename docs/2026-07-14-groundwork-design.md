# groundwork — Design

**Date:** 2026-07-14
**Status:** Approved, ready for implementation planning

## Purpose

A reusable Turborepo boilerplate for fullstack apps — public web client, admin console, and API backend — distilled from the hardened [ceylon-experience-luxury-travel](https://github.com/Code-Xeed) repos. Every new project starts from this template with authentication, RBAC, audit logging, file uploads, and transactional email already working, and with zero travel-domain code to delete.

Ships as a **private GitHub template repository** at `dfansoo/groundwork`, so new projects begin with:

```
gh repo create my-app --template dfansoo/groundwork --private
```

The name is deliberately about _purpose_, not _stack_ — it stays honest if a layer is swapped later.

## Source material

Four separate repos in the `Code-Xeed` org, each with its own git history:

| Repo               | Stack                              | Role here                                  |
| ------------------ | ---------------------------------- | ------------------------------------------ |
| `ceylon-…-backend` | NestJS 11, Prisma 7, Postgres, Bun | Source of the hardened API spine           |
| `ceylon-…-web`     | Next.js 16, React 19, Tailwind v4  | Source of frontend auth/session logic      |
| `ceylon-…-admin`   | Same + `features/` layer           | Source of admin shell, permissions, upload |
| `ceylon-…-infra`   | Terraform                          | **Out of scope** (see Non-goals)           |

The backend's `package.json` is already named `nestjs-boilerplate` — it descends from a boilerplate, and this spec returns it to that role.

## Non-goals

Deliberately excluded, to keep the template lean. Each is a per-project decision, not a template concern:

- **`infra/` (Terraform)** — cloud topology varies too much per project.
- **Root `docker-compose`** — `apps/backend` keeps its own compose file (Postgres) since it ships with the backend; there is no root-level orchestration.
- **CI (GitHub Actions)** — no root workflow.
- **Ceylon domain code** — all of it (see Prisma and module tables below).

---

## Architecture

### Layout

```
groundwork/
├── apps/
│   ├── web/        Next 16 public client        :3000
│   ├── admin/      Next 16 admin console        :3001
│   └── backend/    NestJS 11 + Prisma 7 API     :9000
├── packages/
│   ├── ui/                 @workspace/ui — shadcn components, theme, cn()
│   ├── api-client/         @workspace/api-client — generated from OpenAPI
│   ├── eslint-config/      @workspace/eslint-config
│   └── typescript-config/  @workspace/typescript-config
├── turbo.json
└── package.json            Bun workspaces
```

**Package manager:** Bun 1.3.9 workspaces (matches all four source repos; `bun.lock` throughout).
**Orchestration:** Turborepo 2.9.

### Foundation is generated, not hand-built

The frontend half of the monorepo is scaffolded by the shadcn CLI, which ships a Turborepo + Bun workspace skeleton natively:

```
bunx shadcn@latest init --preset b6TpjxDODI --template next --monorepo -n groundwork
```

This produces the root workspace, `turbo.json`, `packages/ui`, `packages/eslint-config`, `packages/typescript-config`, and `apps/web` — pre-wired. We do not hand-author any of it.

**The preset (`b6TpjxDODI`) resolves to:** `base-maia` style, **Base UI** (not Radix), `neutral` base color, **Tabler** icons, CSS-variable theming, `--radius: 0.45rem`, an emerald chart ramp, Inter (sans) / Space Grotesk (heading) / Geist Mono, and dark mode via `next-themes`.

**Version policy — latest stable.** The template pins Next `16.2.6`; we bump to **Next `16.2.10`** and **React `19.2.7`** (current stable as of this date). Tailwind v4, TypeScript 5.

### Ceylon's `components/ui` is not ported

Ceylon's shadcn components are an older style on an older Base UI. Porting them would fight the preset. Instead we **regenerate** components into `packages/ui` via `shadcn add`, in `base-maia` style, shared by both frontends. Icons standardize on **Tabler**, replacing Ceylon's Hugeicons.

**We port logic, not components.** From the frontends that means `lib/{auth, auth-tokens, secure-cookies, env, api, permissions, form-errors, upload, utils}`, `proxy.ts`, the providers, the auth pages, the admin shell, and the `features/` pattern.

---

## Authentication

**The backend is the identity source of truth.** This is the load-bearing architectural decision, and everything else follows from it.

NestJS owns `User`, `Account`, `AuthSession`, `PasswordResetToken`; bcrypt hashing; RS256 JWT signing and refresh rotation; session listing and revocation; OAuth provider linking; password reset — plus the RBAC guards and audit trail already wired into every other module. Web, admin, and any future mobile client all consume it.

**NextAuth v5 stays, as a shim only.** In `apps/web` and `apps/admin` it does exactly two jobs:

1. Runs the Google OAuth redirect dance, then trades the profile for backend tokens at `POST /auth/exchange` (protected by `ExchangeSecretGuard` and a shared secret).
2. Holds the backend access/refresh tokens in an encrypted cookie, refreshing them against `POST /auth/refresh` and revoking at `POST /auth/logout` on sign-out.

**Better Auth was considered and rejected.** It is an auth _server_ — it wants to own the user/session/account tables and issue its own sessions. Using it in the frontends would put a second auth server in front of the real one, with two session stores that can disagree. Using it _properly_ would mean mounting it inside NestJS and rewriting the hardened auth module and all four guards on a community Nest adapter — i.e. rewriting the most security-critical code we own at the exact moment we are trying to preserve it. Rejected on risk.

**Beta risk is accepted and contained.** `next-auth@5.0.0-beta.*` has been in beta a long time. Exposure is one ~100-line file per app; because the backend owns everything real, it can be swapped for a `jose` encrypted-cookie session without touching the backend. Documented as a known escape hatch.

**Auth endpoints (kept in full):** `register · login · forgot-password · reset-password · exchange · refresh · logout · sessions (list/revoke) · providers (list/link/unlink) · profile`.

**Guards (kept):** `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard`, `ExchangeSecretGuard`.

---

## Backend

### Modules

| Kept (the spine)                            | Dropped (Ceylon domain)                  |
| ------------------------------------------- | ---------------------------------------- |
| `auth`, `users`, `staff`                    | `bookings`, `catalog`, `tours`, `hotels` |
| `prisma`, `config`, `audit`                 | `packages`, `pricing`, `guides`          |
| `files`, `mail`, `common`, `utils`, `types` | `tourists`, `documents`, `inquiries`     |
| `items` _(new — the example feature)_       | `common/currency`                        |

`common` keeps `pagination`, `sorting`, `slug`, and `crypto`. `currency` is pricing-domain and goes. `inquiries/captcha` (Cloudflare Turnstile) goes with `inquiries`; `TURNSTILE_SECRET_KEY` is dropped from the env schema.

### Prisma

**Kept:** `User`, `Account`, `AuthSession`, `PasswordResetToken`, `UserRole`, `Role` (enum), `AuditLog`, `FileAsset`, plus a new `Item`.

**Dropped:** `Hotel`, `RoomType`, `Tour`, `TourPricingMode` (enum), `BlackoutDate`, `Guide`, `GuideAvailability`, `Package`, `PackageDay`, `PricingRule`, `TouristProfile`, `TravelDocument`, `Inquiry`, `InquiryMessage`, `Booking`, `BookingDay`, `BookingTraveler`, `Invoice`.

**Known migration work:** the kept models carry relation fields pointing at dropped ones (e.g. `User → TouristProfile`/bookings, and `FileAsset`'s orphan-sweep references hotels/tours/documents). Every such relation must be stripped or repointed at `Item`. Migration history is **not** ported — the boilerplate ships a single clean `init` migration generated from the reduced schema, plus a seed that creates the admin user from `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

### Two fixes carried into the boilerplate

These are defects in the source, not features to preserve.

**1. CORS is silently wide open.** `main.ts` enables CORS three times — `NestFactory.create({ cors: true })`, then `enableCors({ origin: ALLOWED_ORIGINS, credentials: true })`, then a bare `app.enableCors()`. The last call wins and resets origin to `*`, so the `ALLOWED_ORIGINS` allowlist never takes effect. The boilerplate calls `enableCors` **once**, with the allowlist. _(Ceylon should be patched separately — out of scope here.)_

**2. A fresh clone cannot boot.** `DATA_ENCRYPTION_KEY`, `AWS_REGION`, `ASSETS_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DOMAIN`, and `CLOUDFRONT_KEY_PAIR_ID` are all `Joi.required()`, so the API refuses to start without a real AWS account and a CloudFront keypair. The boilerplate introduces `FILES_DRIVER=local|s3` (default `local`), mirroring the existing `MAIL_TRANSPORT=log|brevo` pattern: `local` writes uploads to disk and serves them directly, and the AWS/CloudFront vars become required **only when** `FILES_DRIVER=s3`. `DATA_ENCRYPTION_KEY` stays required but the setup script generates one into `.env` on first run.

**Result:** `bun install && bun run db:migrate && bun dev` works on a clean machine with only Postgres.

### Bootstrap (kept)

Helmet, compression, URI versioning, global `ValidationPipe` (whitelist + `forbidNonWhitelisted` + the 422 `exceptionFactory`), `ResponseInterceptor`, `CustomExceptionFilter`, request logging (morgan), Swagger at `/doc`, `@nestjs/throttler` rate limits on the auth routes, `nestjs-cls`, Prisma shutdown hooks.

---

## Type sync: `packages/api-client`

The backend validates with `class-validator` DTOs; the frontends use Zod. Rather than rewrite either side, **the backend is the source of truth and types flow one way**:

1. `apps/backend` gets an `openapi` script that boots the Nest app headlessly and writes `openapi.json` (it already has `@nestjs/swagger` and a `DocumentBuilder`).
2. `packages/api-client` runs `openapi-typescript` over that file to emit types, and wraps a small typed `fetch` client that injects the bearer token and normalizes errors to match `ResponseInterceptor` / `CustomExceptionFilter` response shapes.
3. Turbo enforces the order: `backend#openapi → api-client#build → {web,admin}#build`.

Frontends never hand-write API types; drift is impossible by construction.

---

## The `items` example feature

The single thing that makes this a boilerplate rather than an empty shell. One thin CRUD resource threaded end to end, demonstrating every pattern a real feature needs:

- **Backend** — `items` module: DTO validation, `PermissionsGuard` on mutations, paginated + sorted list via `common/pagination`, an audit-log entry on write, a `FileAsset` attachment, and unit tests.
- **Admin** — `features/items`: list table, create/edit form (react-hook-form + Zod + `form-errors`), detail view, image upload via `lib/upload`, permission-gated nav entry.
- **Web** — a read-only public list/detail view.
- **Tests** — Vitest unit + Playwright e2e for the flow.

It is the copy-paste-rename target for every new feature. Deleting `items` leaves a clean slate.

---

## Frontend apps

Both apps share `@workspace/ui` and `@workspace/api-client`, and both keep: `proxy.ts` (Next 16's renamed middleware), providers (TanStack Query, `next-themes`, Sonner), validated `lib/env`, `lib/secure-cookies`, `lib/auth` + `lib/auth-tokens`, error/not-found boundaries, `Dockerfile`, Vitest, and Playwright.

**`apps/web` (:3000)** — public client. Auth pages (`login`, `register`, `forgot-password`, `reset-password`), an `account` area (profile, sessions, password), `robots.ts` + `sitemap.ts`, and the read-only `items` view.

**`apps/admin` (:3001)** — admin console. `login`, a `(dashboard)` route group behind the shell (sidebar + nav), `lib/permissions` for RBAC-gated UI, `lib/form-errors`, `lib/upload`, and the `features/` layer with `features/items`.

---

## Turbo tasks

Template ships `build`, `dev`, `lint`, `format`, `typecheck`. We add:

| Task       | Notes                                                          |
| ---------- | -------------------------------------------------------------- |
| `test`     | Vitest (web/admin), Jest (backend)                             |
| `test:e2e` | Playwright                                                     |
| `openapi`  | Backend emits `openapi.json`; `api-client#build` depends on it |

`dev` stays `cache: false, persistent: true`. `build` keeps `dependsOn: ["^build"]`.

---

## Secrets hygiene

The source tree contains **real** `.env`, `.env.local`, and a `keys/` directory with live PEMs. This repo becomes a template, so:

- Files are copied **allowlist-style, one by one**. No recursive directory copy, ever.
- Only `.env.example` files ship. `.env*` (except `.env.example`) and `keys/` are git-ignored from the first commit.
- Keys are produced by `bun run keys:generate` on first setup, never committed.
- Before the first push, the working tree is scanned for secrets and the diff reviewed.

---

## Testing

Ported as-is from the source: **Vitest** (+ Testing Library, jsdom) for web/admin units, **Jest** for backend units, **Playwright** for e2e in both frontends. The `items` feature ships with tests at every layer, so the template demonstrates the testing pattern rather than merely permitting one.

---

## Delivery

1. Scaffold via `shadcn init --preset b6TpjxDODI --template next --monorepo -n groundwork`.
2. Bump to Next 16.2.10 / React 19.2.7.
3. Add `apps/admin` (clone of web, :3001, shell + features).
4. Port `apps/backend` — spine only, both fixes applied, clean Prisma init migration.
5. Add `packages/api-client` + the Turbo wiring.
6. Build the `items` feature end to end.
7. Verify: clean-machine `bun install && bun run db:migrate && bun dev`, then `turbo lint typecheck test build`.
8. Push to `dfansoo/groundwork` (**private**, template flag on).
