# Daily Mood Tracker

A full-stack Next.js 16 + Tailwind CSS 4.0 experience for logging one mood per day. Users can register/login, save reflections to PostgreSQL via Prisma, and there’s now a password-protected admin dashboard to monitor adoption.

## Features

- 🧠 **Daily mood logging** – five curated vibes with emoji icons + optional note.
- 🔐 **Authentication** – email/password auth with bcrypt hashing.
- 🗃️ **PostgreSQL storage** – Prisma models keep users + entries in sync (one entry per day enforced).
- 📈 **Timeline + stats** – weekly counter, latest vibe card, and timeline list.
- 🧑‍💻 **Admin dashboard** – `/admin` route displays total users & entries when unlocked with your secret key.
- 🎨 **Polished UI** – glassmorphism cards, sticky navigation, responsive layout.

## Prerequisites

1. **Environment variables** – update `.env`:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/moodtracker?schema=public"
   ADMIN_DASHBOARD_KEY="set-a-strong-random-string"
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Generate Prisma client + push schema**
   ```bash
   npx prisma generate
   npx prisma db push
   # or run: psql "$DATABASE_URL" -f prisma/schema.sql
   ```

## Running locally

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start    # after build
```

## API summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/register` | POST | `{ email, password, name? }` → create user |
| `/api/login`    | POST | `{ email, password }` → returns user if valid |
| `/api/entries`  | GET  | `?userId=...` → list moods for user |
| `/api/entries`  | POST | `{ userId, mood, note?, date }` → save one entry |
| `/api/admin/summary` | GET | Requires `Authorization: Bearer ADMIN_DASHBOARD_KEY` → totals |

> Sessions are stored in `localStorage` (see `src/lib/auth-storage.ts`). Upgrade to secure cookies or NextAuth before shipping to production.

## Project structure (high level)

```
prisma/
  schema.prisma          # Prisma models (User, MoodEntry)
  schema.sql             # Raw SQL if you prefer manual setup
src/
  app/
    (auth)/login         # Login form (auto-redirects to home on success)
    (auth)/register      # Registration flow
    admin/               # Admin dashboard UI (token-protected)
    api/
      login              # Auth endpoint
      register           # Registration endpoint
      entries            # Mood CRUD
      admin/summary      # Admin stats endpoint
    layout.tsx           # Global nav/footer
    page.tsx             # Mood tracker UI
    globals.css          # Tailwind + base styles
  lib/
    prisma.ts            # Prisma client
    controllers/auth.ts  # Auth helpers
    auth-storage.ts      # Local storage helpers
```

## Using the admin dashboard

1. Set `ADMIN_DASHBOARD_KEY` in `.env` and restart `npm run dev`.
2. Visit http://localhost:3000/admin and enter the same key.
3. You’ll see total user count + mood entries. Token is cached in `localStorage` (`mood-admin-token`).

## Customization ideas

- Switch from client-side auth storage to JWT/NextAuth for true sessions.
- Add more analytics cards (streaks, popular moods, weekly charts).
- Build a calendar heatmap or export to CSV.
- Deploy to Vercel + managed PostgreSQL for production testing.

Enjoy a clean, user-friendly journaling flow backed by a real database and admin insights! 🌈
