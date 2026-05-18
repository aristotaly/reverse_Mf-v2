# reverse_Mf-v2 — Weight Trend Tracker (multi-user)

A mobile-first weight tracking web app with EWMA trend analytics, built with Next.js, Prisma, and Tailwind CSS. This is the **v2** branch: it adds a real multi-user authorization model and an admin console on top of [revers-mf](https://github.com/aristotaly/revers-mf).

> **Maintainers & contributors:** read [`MAINTAINING.md`](./MAINTAINING.md) for the long-form guide to architecture, the analytics math, deployment, and operations playbooks.

## Features

- **Scale Weight** — log daily weight entries (kg)
- **Weight Trend** — EWMA-smoothed trend line with interpolation for missing days
- **Dashboard** — KPIs, Recharts chart, period filters, daily breakdown table
- **Multi-user auth** — username + password, each user sees only their own data
- **Admin console** at `/admin` — create users, reset passwords, change roles, delete users, with self-protection (can't lock out the last admin)
- **Installable PWA** — add to home screen on iOS/Android, install as a desktop app on Chrome/Edge, with an offline fallback shell

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + Radix UI primitives
- Prisma ORM (SQLite local / PostgreSQL on Vercel)
- Recharts + Playwright

## Prerequisites

Use [NVS](https://github.com/jasongin/nvs) for Node.js:

```powershell
$env:NVS_HOME = "$env:LOCALAPPDATA\nvs"
. "$env:NVS_HOME\nvs.ps1"
nvs add lts
nvs use lts
```

## Local development

```bash
npm install
cp .env.example .env

npm run db:generate:local
npm run db:push:local
npm run db:seed

npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Default login: `admin` / `1234` (the seeded admin). From the dashboard footer, click **Manage users** to add more accounts.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server (SQLite, regenerates Prisma client) |
| `npm run build` | Production build (Postgres Prisma client) |
| `npm run db:seed` | Seed user and ~30 days of sample weights |
| `npm run db:seed:test` | Reset DB with Playwright fixture data |
| `npm run test:e2e` | Playwright end-to-end tests |

## Vercel deployment

1. Create a Vercel Postgres database and attach to the project.
2. Set environment variables:
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
   - `SESSION_SECRET`
   - `SEED_PASSCODE` (optional, for seeding)
3. Build command:

   ```
   prisma generate --schema=prisma/schema.prisma && prisma db push --schema=prisma/schema.prisma && next build
   ```

4. Run `npm run db:seed` once against production (or use Vercel CLI).

## Analytics

Trend values are computed in memory (`utils/analytics.ts`) using EWMA with α = 0.1. Missing days between entries are filled via linear interpolation. Only raw scale weights are stored in the database.

## Installing as an app

The app ships as a Progressive Web App (PWA) and can be installed on every major platform:

- **iOS (Safari)** — open in Safari, tap the Share button, then **Add to Home Screen**. The in-app banner walks you through it on first visit.
- **Android (Chrome / Edge / Brave)** — accept the **Install Weight Trend** prompt, or use the browser menu's **Install app** entry.
- **Desktop (Chrome / Edge / Brave)** — click the install icon in the URL bar, or **⋮ → Install Weight Trend**.

Once installed, the app runs fullscreen, gets its own icon, and falls back to a friendly offline screen when the network is gone. To regenerate icons after editing the artwork:

```bash
npm run icons:generate
```

See [`MAINTAINING.md`](./MAINTAINING.md#18-progressive-web-app-pwa) for the full PWA implementation details.

## License

Private — personal use.
