# Sakneen Client Dashboards

Multi-tenant web app for Sakneen. MVP: live EOI dashboard for Paragon Adeer, replacing the daily static PDF.

Full project context, build plan, schema, and design system live in [`handoff/`](./handoff/). Read [`handoff/README.md`](./handoff/README.md) first.

## Quickstart

```bash
# 1. Postgres (Docker)
docker compose up -d

# 2. Install deps + run dev
pnpm install
pnpm dev
```

App at http://localhost:3000. Postgres at localhost:5432 (user/pass/db all `sakneen` / `sakneen` / `sakneen_dashboards`).

## Stack

Next.js 15 (App Router) + TypeScript, Tailwind v4, Postgres + Drizzle, NextAuth v5, Recharts, Playwright (PDF). Hosted on Railway. Package manager: pnpm.

See `handoff/docs/03-architecture.md` for why.

## Scripts

```bash
pnpm dev          # local dev
pnpm build        # production build
pnpm lint         # eslint
```

DB scripts (added in Day 2):
```bash
pnpm db:generate  # generate migration
pnpm db:migrate   # apply migrations
pnpm db:seed      # seed Paragon + admin
pnpm db:studio    # Drizzle Studio
```
