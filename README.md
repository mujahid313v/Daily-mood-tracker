# Daily Mood Tracker

A full-stack mood journal built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS 4** and **Prisma + PostgreSQL**. Log one mood per day, track the variables that influence it, and watch your own emotional patterns emerge over time.

The application is production-hardened: server-side sessions in `HttpOnly` cookies, strict server-side input validation, rate limiting, constant-time credential comparison and a full set of security headers.

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Screenshots](#screenshots)
- [Folder structure](#folder-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database & Prisma setup](#database--prisma-setup)
- [API documentation](#api-documentation)
- [Authentication flow](#authentication-flow)
- [Security](#security)
- [Running the security test suite](#running-the-security-test-suite)
- [Docker](#docker)
- [Future improvements](#future-improvements)
- [License](#license)

---

## Overview

Daily Mood Tracker is a personal wellbeing journal. A user registers once, then each day records:

- one of five moods — `ecstatic`, `good`, `neutral`, `low`, `stressed`
- an optional note
- up to three tags (eight predefined, plus user-defined ones)
- lifestyle context: sleep hours, exercise minutes, water intake, medication
- the self-care activities they performed

From that data the app derives streaks, rolling averages, a 30-day trend, an 8-week bar chart, a mood distribution donut, a 90-day calendar heatmap, day-of-week patterns, tag correlations, activity correlations and self-care effectiveness rankings. Every entry is private to the account that created it.

A separate **admin dashboard** reports adoption metrics (total users, total entries, latest activity per user) and is protected by a separate key.

---

## Features

### Journal

- **One entry per day**, enforced by a database-level unique constraint on `(userId, date)`
- Five curated moods with emoji, colour and description
- Optional headline note (up to 500 characters)
- Up to three tags per entry — eight predefined (`work`, `family`, `health`, `exercise`, `sleep`, `social`, `weather`, `finances`) plus custom tags
- Lifestyle tracking: sleep, exercise, water, medication
- Twelve built-in self-care activities with mood-based suggestions
- Full edit and delete with ownership checks

### Analytics

- Current logging **streak** and monthly consistency score
- Average mood score (1–5) with a plain-language label
- Trend direction versus the previous week
- **Six chart views**: 30-day overview, 8-week averages, mood distribution donut, 90-day calendar heatmap, day-of-week analysis, tag correlation
- Activity correlations (sleep / exercise / water vs. mood) and self-care effectiveness ranking
- Achievements: first entry, 7- and 30-day streaks, 100 entries, perfect week, tag master, activity streak
- Month-over-month comparison

### Usability

- Search across notes, moods, tags and dates
- Date filters: all time, last 7 days, last 30 days, this month, last month, custom range
- Tag filter
- CSV export and a printable HTML report
- JSON backup export and restore (merge or replace)
- Light / dark theme
- Daily reminder via the browser Notification API
- Anonymous community mood board with today and 7-day distribution
- Fully responsive, keyboard accessible UI

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack, React Compiler enabled, `output: "standalone"`) |
| UI | React 19.2.3, Tailwind CSS 4 |
| Language | TypeScript 5 (strict mode) |
| Database | PostgreSQL via Prisma 5 |
| Sessions | `jose` — HS256 signed JWT in an `HttpOnly` cookie |
| Password hashing | `bcryptjs` (cost 12) |
| Validation | Zod 4 |
| Security headers | `next.config.ts` → `headers()` |
| Tooling | ESLint 9 (flat config), Docker |

---

## Screenshots

> **Screenshots placeholder.**
>
> | Screen | Description | Image |
> |---|---|---|
> | Journal | Mood picker, tags, lifestyle inputs, latest-vibe card | `_docs/screenshots/journal.png` |
> | Analytics | Chart tabs, streak, achievements, correlations | `_docs/screenshots/analytics.png` |
> | Timeline | Search, filters and the day-by-day entry list | `_docs/screenshots/timeline.png` |
> | Admin | Usage metrics and the per-user activity table | `_docs/screenshots/admin.png` |
>
> Drop the images into `_docs/screenshots/` and update the table above.

---

## Folder structure

```
Daily-mood-tracker/
├── prisma/
│   ├── schema.prisma            # Source of truth — User, MoodEntry, CommunityMood
│   └── schema.sql               # Generated PostgreSQL DDL (manual provisioning only)
├── public/                      # Static assets
├── scripts/
│   └── security-check.mjs       # End-to-end security test suite (73 assertions)
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout: fonts, sticky nav, metadata
│   │   ├── page.tsx              # Journal + analytics + timeline (client component)
│   │   ├── globals.css           # Tailwind v4 theme, light/dark CSS variables
│   │   ├── favicon.ico
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx    # /login
│   │   │   └── register/page.tsx # /register
│   │   ├── admin/page.tsx        # /admin — key-gated analytics dashboard
│   │   └── api/
│   │       ├── login/route.ts           # POST  — authenticate, set session cookie
│   │       ├── logout/route.ts          # POST  — clear session cookie
│   │       ├── register/route.ts        # POST  — create account, set session cookie
│   │       ├── me/route.ts              # GET   — current user
│   │       ├── entries/route.ts         # GET/POST/PUT/DELETE — mood entries
│   │       ├── community/mood/route.ts  # GET/POST — anonymous mood board
│   │       ├── backup/route.ts          # GET   — export JSON backup
│   │       ├── backup/import/route.ts   # POST  — import JSON backup
│   │       ├── admin/session/route.ts   # GET/POST/DELETE — admin cookie session
│   │       └── admin/summary/route.ts   # GET   — admin analytics
│   ├── components/
│   │   └── NavBar.tsx           # Session-aware navigation
│   └── lib/
│       ├── session.ts           # JWT sign / verify, HttpOnly cookie handling
│       ├── admin-session.ts     # Admin key comparison + admin cookie session
│       ├── session-client.ts    # Browser helpers: /api/me + auth change event
│       ├── use-current-user.ts  # React hook wrapping the session
│       ├── validation.ts        # Every Zod schema + error formatting
│       ├── rate-limit.ts        # In-memory fixed-window limiter
│       ├── http.ts              # Shared JSON responses, IP resolution
│       ├── entries.ts           # Entry serialisation
│       ├── parse.ts             # parseList — JSON/comma list parsing
│       ├── prisma-error.ts      # Prisma error code helpers
│       ├── prisma.ts            # PrismaClient singleton
│       └── controllers/
│           └── auth.ts          # registerUser / authenticateUser (bcrypt)
├── .dockerignore                # Keeps secrets and node_modules out of the image
├── .env.example                 # Documented environment template
├── Dockerfile                   # node:20-slim production image
├── eslint.config.mjs
├── next.config.ts               # Config + security headers
├── postcss.config.mjs
└── tsconfig.json
```

---

## Getting started

### Prerequisites

- **Node.js 20.9+** (the project is built and tested on Node 20 and 24)
- **npm 10+**
- A **PostgreSQL** database — local, Neon, Supabase, RDS, any hosted provider

### 1. Install dependencies

```bash
npm install
```

### 2. Configure the environment

```bash
cp .env.example .env
```

Fill in the three variables (see [Environment variables](#environment-variables)):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/moodtracker?schema=public"
JWT_SECRET="<openssl rand -base64 48>"
ADMIN_DASHBOARD_KEY="<openssl rand -base64 32>"
```

### 3. Set up the database

```bash
npx prisma generate   # generate the Prisma client
npx prisma db push    # create the tables, indexes and constraints
```

### 4. Run the development server

```bash
npm run dev
```

Open <http://localhost:3000>.

### 5. Verify the build and the security posture

```bash
npm run lint
npm run build
npm run test:security   # 73 end-to-end security assertions
npm run test:smoke      # 34 functional assertions over the whole user journey
```

### Production

```bash
npm run build
npm run start        # http://localhost:3000
```

---

## Environment variables

All configuration lives in `.env`, which is **never committed**. Copy `.env.example` and fill it in.

| Variable | Required | Purpose | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string used by Prisma | e.g. `postgresql://user:pass@host:5432/moodtracker?schema=public` |
| `JWT_SECRET` | ✅ | Signs and verifies the session JWTs (HS256) | Minimum 16 characters. Generate with `openssl rand -base64 48`. Rotating it invalidates every active session. |
| `ADMIN_DASHBOARD_KEY` | ✅ | Unlocks the `/admin` dashboard | Generate with `openssl rand -base64 32`. Compared in constant time. |

<details>
<summary>Deprecated / legacy</summary>

`AUTH_SECRET` is still accepted as a fallback for `JWT_SECRET` so that deployments created before `JWT_SECRET` was introduced keep working. It is deprecated — migrate to `JWT_SECRET`.

</details>

> `.env.example` is tracked in git; `.env` is ignored. A `.dockerignore` additionally keeps `.env` out of the Docker build context so secrets are never baked into an image layer.

---

## Database & Prisma setup

The datasource is PostgreSQL. `prisma/schema.prisma` is the single source of truth.

### Models

**User**

| Column | Type | Constraints |
|---|---|---|
| `id` | `TEXT` | PK, `cuid()` |
| `email` | `TEXT` | **UNIQUE**, stored lower-cased |
| `password` | `TEXT` | bcrypt hash — never returned by any endpoint |
| `name` | `TEXT` | nullable |
| `createdAt` | `TIMESTAMP(3)` | default `now()` |
| `updatedAt` | `TIMESTAMP(3)` | `@updatedAt` |

**MoodEntry**

| Column | Type | Constraints |
|---|---|---|
| `id` | `TEXT` | PK, `cuid()` |
| `userId` | `TEXT` | FK → `User.id` (`ON DELETE RESTRICT`) |
| `mood` | `TEXT` | one of the five mood ids |
| `note` | `TEXT` | nullable |
| `tags` | `TEXT` | nullable, JSON array |
| `date` | `TIMESTAMP(3)` | the calendar day, stored at UTC midnight |
| `sleepHours` | `DOUBLE PRECISION` | nullable |
| `exerciseMinutes` | `INTEGER` | nullable |
| `waterIntake` | `INTEGER` | nullable |
| `medication` | `TEXT` | nullable |
| `completedActivities` | `TEXT` | nullable, JSON array |
| `createdAt` | `TIMESTAMP(3)` | default `now()` |

**UNIQUE (`userId`, `date`)** — one entry per user per day, enforced by the database.

**CommunityMood**

| Column | Type | Constraints |
|---|---|---|
| `id` | `TEXT` | PK, `cuid()` |
| `mood` | `TEXT` | |
| `date` | `TIMESTAMP(3)` | default `now()`, **indexed** |

> **Index:** `CommunityMood(date)` — the board is queried by date range on every load and grows without bound.

### Applying changes

```bash
npx prisma db push       # development — applies the schema directly
npx prisma migrate dev   # development — creates a migration
npx prisma migrate deploy # production — applies pending migrations
npx prisma studio        # browse the data
```

### Manual provisioning

If you cannot run Prisma against your database, apply the generated DDL directly:

```bash
psql "$DATABASE_URL" -f prisma/schema.sql
```

`prisma/schema.sql` is generated from `prisma/schema.prisma` and kept in sync with it:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/schema.sql
```

---

## API documentation

All responses are JSON. Protected routes read the user id from the **verified session cookie** — never from a query string or request body.

| Method | Endpoint | Auth | Description | Success | Errors |
|---|---|---|---|---|---|
| `POST` | `/api/register` | — | Create an account and start a session. Body: `{ email, password, name? }` | `201` | `400` validation · `409` email taken · `429` rate limited |
| `POST` | `/api/login` | — | Authenticate and start a session. Body: `{ email, password }` | `200` | `400` validation · `401` invalid credentials · `429` rate limited |
| `POST` | `/api/logout` | cookie | Destroy the session (expires the cookie) | `200` | — |
| `GET` | `/api/me` | cookie | The currently signed-in user | `200` | `401` not authenticated |
| `GET` | `/api/entries` | cookie | Every entry owned by the session user, newest first | `200` | `401` |
| `POST` | `/api/entries` | cookie | Create an entry. Body: `{ mood, note?, tags?, date, sleepHours?, exerciseMinutes?, waterIntake?, medication?, completedActivities? }` | `201` | `400` validation · `401` · `409` entry already exists for that day |
| `PUT` | `/api/entries` | cookie | Update an entry. Body: `{ id, mood, note?, tags?, date, … }` | `200` | `400` · `401` · `403` not the owner · `404` · `409` |
| `DELETE` | `/api/entries?id=…` | cookie | Delete an entry | `200` | `400` · `401` · `403` not the owner · `404` |
| `GET` | `/api/community/mood` | — | Today's and the last 7 days of community distribution | `200` | `500` |
| `POST` | `/api/community/mood` | — | Submit an anonymous mood. Body: `{ mood }` | `201` | `400` validation · `429` rate limited |
| `GET` | `/api/backup` | cookie | Export every entry as a JSON backup document | `200` | `401` |
| `POST` | `/api/backup/import` | cookie | Import a backup. Body: `{ mode: "merge" \| "replace", entries: [...] }` | `200` | `400` validation · `401` |
| `GET` | `/api/admin/session` | admin cookie | Whether an admin session is currently active | `200` | — |
| `POST` | `/api/admin/session` | — | Exchange the admin key for a short-lived admin cookie. Body: `{ key }` | `200` | `400` validation · `401` invalid key · `429` rate limited |
| `DELETE` | `/api/admin/session` | admin cookie | End the admin session | `200` | — |
| `GET` | `/api/admin/summary` | admin cookie **or** `Authorization: Bearer <ADMIN_DASHBOARD_KEY>` | Usage statistics and per-user activity | `200` | `401` · `429` rate limited |

### Validation rules

| Field | Rule |
|---|---|
| `email` | Valid address, trimmed and lower-cased |
| `password` | 8–128 characters (registration) |
| `name` | Optional, ≤ 80 characters |
| `mood` | Exactly one of `ecstatic`, `good`, `neutral`, `low`, `stressed` |
| `note` | ≤ 500 characters |
| `date` | `YYYY-MM-DD` **and** a real calendar date (`2026-02-31` is rejected) |
| `tags` | ≤ 10 tags, each 1–30 characters |
| `completedActivities` | ≤ 20 ids, each ≤ 50 characters |
| `sleepHours` | 0–24 |
| `exerciseMinutes` | Integer 0–480 |
| `waterIntake` | Integer 0–20 |
| `medication` | ≤ 100 characters |

A validation failure returns:

```json
{
  "error": "Validation failed",
  "details": [{ "field": "password", "message": "Password must be at least 8 characters" }]
}
```

---

## Authentication flow

```
                    ┌──────────────────────────────────────────┐
                    │  Browser — no token in JavaScript ever    │
                    └──────────────────────────────────────────┘
                                    │
      POST /api/register  or  POST /api/login
                    │
                    ▼
    ┌───────────────────────────────────────────────┐
    │  Server                                       │
    │  1. Validate the payload with Zod             │
    │  2. Hash / verify the password with bcrypt    │
    │  3. Sign a JWT  { sub: userId, email, … }    │
    │     HS256, 7-day expiry, issuer + audience    │
    │  4. Set-Cookie: mood_session=…; HttpOnly;     │
    │     SameSite=Lax; Path=/; Max-Age=604800;     │
    │     Secure (production)                       │
    └───────────────────────────────────────────────┘
                    │
                    ▼
      GET /api/entries  (browser attaches the cookie automatically)
                    │
                    ▼
    ┌───────────────────────────────────────────────┐
    │  Server verifies the JWT, resolves userId     │
    │  and scopes the query with where: { userId }  │
    └───────────────────────────────────────────────┘
```

Key properties:

- The **cookie is the only source of truth**. Nothing about the session is written to `localStorage`, `sessionStorage` or IndexedDB.
- `HttpOnly` means JavaScript cannot read the token, so an XSS bug cannot exfiltrate the session.
- `SameSite=Lax` blocks cross-site POSTs, which mitigates CSRF for the state-changing endpoints.
- `Secure` is added automatically when `NODE_ENV === "production"`.
- Every protected route resolves the user through `getSessionUser(request)`; there is no client-supplied identity anywhere in the request path.
- `POST /api/logout` expires the cookie (`Max-Age=0`).
- `GET /api/me` lets the client ask "who am I?" without exposing the token.

---

## Security

### Vulnerabilities found and how they were fixed

#### 1. Sessions stored in `localStorage` — session theft via XSS

**Before.** `src/lib/auth-storage.ts` persisted the user object under the key `daily-mood-auth-user`, and the client decided whether a user was "signed in" by reading it back. Any XSS anywhere in the app could read that key.

**After.**
- The file is **deleted**. No authentication state is stored in the browser.
- `src/lib/session.ts` signs a **HS256 JWT** with `jose` and stores it in the `mood_session` cookie with `HttpOnly`, `SameSite=Lax`, `Path=/`, a 7-day `Max-Age` and `Secure` in production.
- The browser only asks the server who it is, via `GET /api/me` (`src/lib/session-client.ts`, `src/lib/use-current-user.ts`).
- `POST /api/logout` expires the cookie.
- The token is verified with an explicit `algorithms: ["HS256"]` allow-list plus `issuer` and `audience` checks, so an algorithm-confusion or cross-application token cannot be replayed.

#### 2. IDOR — `/api/entries` trusted a client-supplied `userId`

**Before.** The route read the owner from the request body or the query string. Any authenticated user could set `userId` to somebody else's id and read, overwrite or delete that user's entries.

**After.**
- `src/app/api/entries/route.ts` derives the owner **only** from the verified session cookie (`getSessionUser(request)`).
- The request body is parsed by `moodEntrySchema`, a Zod object that **strips unknown keys** — a forged `userId` is discarded before it can reach the database.
- `PUT` and `DELETE` perform an explicit ownership comparison and return `403 Forbidden` when it fails.
- Responses never include the owning `userId`, so an identifier cannot leak sideways.
- The database keeps `UNIQUE (userId, date)`, so one entry per user per day remains enforced regardless of application logic.

#### 3. Admin key cached in `localStorage`

**Before.** `/admin` wrote the key to `localStorage` under `mood-admin-token` and sent it as a `Bearer` header from JavaScript.

**After.**
- `POST /api/admin/session` exchanges the key once for a **short-lived (15 minute) `HttpOnly` cookie** (`mood_admin`, `SameSite=Strict`). The key itself is discarded by the browser.
- The dashboard restores the session from that cookie on load and can lock it again with `DELETE /api/admin/session`.
- `GET /api/admin/summary` accepts either the cookie **or** an `Authorization: Bearer <key>` header, so scripts and CI keep working — the check happens on the server either way.
- The key is compared with `crypto.timingSafeEqual`. Both values are hashed with SHA-256 first so the comparison always runs on two fixed-length buffers and the secret's length cannot be inferred from response timing.

#### 4. No input validation

**Before.** Endpoints accepted whatever was in the body. An arbitrary `mood` string, an arbitrarily long note, a malformed date and a one-character password were all accepted.

**After.**
- `src/lib/validation.ts` defines a Zod schema for every payload — email format, 8-character minimum password, the mood enum, note length, a real `YYYY-MM-DD` calendar date, and upper bounds on every collection and number.
- Malformed input returns `400` with per-field messages and never includes driver text or stack frames.
- Prisma's `P2002` unique-constraint error is translated into a clean `409`, so internals never reach the client.
- Login failures return the generic message **"Invalid email or password"** for both an unknown email and a wrong password, so the endpoint cannot be used to enumerate accounts.

#### 5. No rate limiting

**Before.** `/api/login` could be brute forced indefinitely, and the public community endpoint could be flooded.

**After.** `src/lib/rate-limit.ts` implements a fixed-window limiter:

| Endpoint | Limit |
|---|---|
| `POST /api/login` | 5 / minute / IP **and** 10 / minute / account |
| `POST /api/register` | 5 / minute / IP |
| `POST /api/admin/session` | 5 / minute / IP |
| `GET /api/admin/summary` | 5 / minute / IP |
| `POST /api/community/mood` | 20 / minute / IP |

Rejected requests return `429` with `Retry-After`, `X-RateLimit-Limit` and `X-RateLimit-Remaining`.

> **Production note.** The limiter stores counters in the memory of a single process. On serverless or behind a load balancer each instance keeps its own counters, so the effective limit scales with the instance count and resets on every cold start. Replace the `Map` with a shared store such as Redis behind the same interface for a multi-instance deployment.

#### 6. No security headers

**Before.** The application shipped with no `Content-Security-Policy` and no clickjacking or MIME-sniffing protection.

**After.** `next.config.ts` attaches the following to every response via `headers()`:

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, plus tight `script-src` / `style-src` / `img-src` / `font-src` / `connect-src` directives |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | camera, microphone, geolocation, payment and USB all disabled |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-origin` |
| `X-DNS-Prefetch-Control` | `off` |
| `X-Permitted-Cross-Domain-Policies` | `none` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) |

The application is entirely self-hosted, so no third-party origins are needed. `'unsafe-inline'` is required in `script-src` because Next.js streams the RSC payload in inline `<script>` tags — a fully nonce-based policy is listed under [Future improvements](#future-improvements).

#### 7. Secrets could be baked into the Docker image

**Before.** There was no `.dockerignore`, so `COPY . .` copied the real `.env` — containing `DATABASE_URL`, `JWT_SECRET` and `ADMIN_DASHBOARD_KEY` — plus `node_modules`, `.next` and the local SQLite files into the image.

**After.** A `.dockerignore` excludes `.env` and every `.env.*` variant, `node_modules`, `.next`, `.git` and `prisma/*.db`. `.gitignore` now ignores `.env` explicitly while keeping `.env.example` tracked.

#### 8. Password hashes could be returned

**After.** `registerUser` and `authenticateUser` select only `{ id, email, name }`. Every endpoint — `/api/register`, `/api/login`, `/api/me`, `/api/admin/summary` — selects fields explicitly and never includes `password`. The security suite asserts that no response body ever contains a bcrypt hash.

#### 9. Additional hardening

- **Timing-safe login.** When the email is unknown, the password is still compared against a dummy bcrypt hash, so response time does not reveal whether an account exists.
- **Email normalisation.** Emails are trimmed and lower-cased, so `A@B.com` and `a@b.com` are one account.
- **Registration race.** A concurrent duplicate registration is caught through Prisma's `P2002` and returned as `409` instead of `500`.
- **bcrypt cost 12**, up from 10.
- **No raw SQL.** All database access goes through Prisma's query builder — user input is never interpolated into SQL.
- **Non-destructive backup import.** The import validates the whole payload first and runs inside a single transaction. In `replace` mode only entries that are *not* part of the backup are deleted, so a failed import can no longer wipe a user's history.
- **Ownership checks** on every mutating entry operation.
- **Bounded payload sizes** on every collection and numeric field, so a request cannot be used as a memory-exhaustion vector.

### Known limitations

- The rate limiter is per-process (see the note above).
- `Content-Security-Policy` still allows `'unsafe-inline'` scripts because Next.js streams the RSC payload inline.
- There is no account lockout, password reset, email verification or CAPTCHA.
- The admin dashboard exposes every user's email and latest note to whoever holds the admin key — acceptable for a single-operator tool, but it should be scoped down or paginated for a multi-tenant deployment.

---

## Running the security test suite

`scripts/security-check.mjs` boots the production server and exercises the security controls over HTTP, then removes the fixtures it creates.

```bash
npm run build
npm run test:security
```

```
✔ All 73 security checks passed.
```

The suite covers:
1. **Unauthenticated access** — every protected endpoint returns `401`
2. **Input validation** — malformed email, short password, invalid mood, malformed and impossible dates, over-long notes all return `400`
3. **Session cookie** — `HttpOnly`, `SameSite=Lax`, an explicit expiry, and no credential leakage
4. **Login** — generic "Invalid email or password" for both unknown accounts and wrong passwords
5. **IDOR** — user A cannot read, write, update or delete user B's data; a forged `userId` in the body or query string is ignored; cross-account `PUT`/`DELETE` return `403`
6. **Uniqueness** — a second entry for the same day returns `409` without leaking Prisma internals
7. **Admin** — missing, wrong and correct keys; the cookie is `HttpOnly` with a 15-minute expiry; the key never reaches the browser
8. **Rate limiting** — exactly 5 login attempts are allowed, the 6th returns `429` with `Retry-After`
9. **Security headers** — CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
10. **Logout** — the cookie is expired and `/api/me` then returns `401`

Point the suite at an already-running server instead of starting one:

```bash
BASE_URL=http://localhost:3000 npm run test:security
```

### Functional smoke test

`scripts/smoke-test.mjs` exercises the complete user journey so that a security
refactor can never silently break a feature:

```bash
npm run build
npm run test:smoke
```

```
✔ All 34 functional checks passed.
```

It covers registration, session resolution, creating / listing / editing /
deleting entries, tag and activity round-tripping, the health metrics, JSON
backup export, backup import in both `merge` and `replace` modes, the community
mood board and logout. Both scripts remove the accounts they create.

---

## Docker

The image is a three-stage build (`deps` → `builder` → `runner`). The final stage contains only the Next.js **standalone** output and runs as the non-root `nextjs` user.

### Build and run

```bash
docker build -t daily-mood-tracker .

docker run -d \
  --name daily-mood-tracker \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://…" \
  -e JWT_SECRET="…" \
  -e ADMIN_DASHBOARD_KEY="…" \
  daily-mood-tracker
```

### Compose

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://user:password@db:5432/moodtracker?schema=public
      JWT_SECRET: ${JWT_SECRET}
      ADMIN_DASHBOARD_KEY: ${ADMIN_DASHBOARD_KEY}
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: moodtracker
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      retries: 10

volumes:
  pgdata:
```

> The image does **not** run migrations on start. Apply the schema before the first request:
> `docker compose exec app npx prisma db push`.

### Notes

- The image is built in three stages — `deps` → `builder` → `runner` — and the final image contains only the Next.js **standalone** server output, so it ships without the dev dependency tree.
- The container runs as the **non-root** `nextjs` user (uid 1001).
- `prisma generate` runs at build time against a placeholder URL; the real credentials are injected at runtime.
- The build stage explicitly deletes `.next/standalone/.env*`. Next.js copies `.env` files into the standalone bundle by default, which would otherwise ship your secrets inside the image.
- `.dockerignore` keeps `.env`, `node_modules`, `.next` and local database files out of the build context — **secrets are never baked into an image layer.**
- A `HEALTHCHECK` polls `/` every 30 seconds.
- The image does **not** run migrations on start. Apply the schema before the first request:
  `docker compose exec app npx prisma db push`.

---

## Future improvements

### Security

- Replace the in-memory rate limiter with a shared Redis-backed store.
- Add a nonce-based `Content-Security-Policy` via a Next.js middleware, removing `'unsafe-inline'` from `script-src`.
- Add password reset, email verification and account lockout.
- Add CSRF tokens for defence in depth on top of `SameSite=Lax`.
- Store sessions server-side (Redis) with a session table so sessions can be revoked individually.
- Add an audit log for administrative actions.
- Encrypt mood notes at rest for users who need it.

### Architecture

- Split `src/app/page.tsx` — it is a single client component of roughly 2,600 lines with 46 state hooks. Extract the mood form, timeline, chart panel, and the various modals into components, and move the analytics into dedicated hooks.
- Introduce a proper test suite (Vitest + React Testing Library) alongside the existing end-to-end security script.
- Add Prisma migrations instead of relying on `db push` for production.
- Move settings (theme, reminders, custom tags) from `localStorage` to the database so a backup restores them and the app follows the user across devices.
- Add pagination and server-side aggregation for the entries and admin endpoints.

### Product

- Push notifications and email reminders instead of only in-page notifications.
- Calendar heatmap with year navigation and export.
- Additional chart types and export to a real PDF (the current "Export PDF" produces a printable HTML document).
- Streak freezes, badges and a public share card.
- CSV formula-injection hardening for exported notes.
- Dark/light theme respecting `prefers-color-scheme` on first visit.

---

## License

MIT — free to use, modify and ship.
