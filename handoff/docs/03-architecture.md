# 03 — Architecture

## TL;DR

```
Next.js (App Router) + Postgres + Playwright (PDF), all on Railway.
One service, one database, one volume. ~$5-15/month.
```

## Why this stack

### Next.js (App Router) over a separate frontend + API

- One repo, one deploy, one mental model
- Server components handle the data-heavy dashboard pages efficiently
- API routes co-locate naturally with the pages that call them
- Playwright PDF export runs as a server-side route, not a separate worker
- Already the language/framework Sakneen team works in (Next.js 15)

### Tailwind over component libraries

- The design is already pixel-defined in the static PDF
- Ant Design (used in main Sakneen platform) is overkill and fights you on custom styling
- Tailwind + our own minimal component primitives = faster, lighter, exact match to PDF
- No design-system lock-in for whitelabel theming later

### Postgres over Supabase / Firebase / etc.

- Railway hosts Postgres natively
- Plain SQL via `pg` or `drizzle-orm` — no vendor lock-in
- Easy to migrate to RDS / Supabase later if needed
- Sakneen platform already uses Postgres so the team knows it

### Railway over Vercel

Detailed reasoning:

| Concern | Vercel | Railway |
|---|---|---|
| Hosts Postgres | No (need Supabase/Neon) | Yes, native |
| File uploads | Works but cold starts hurt | Long-lived server, no issue |
| Headless Chrome for PDF | Painful (chromium-aws-lambda gymnastics) | Just install Playwright, done |
| Cost at this scale | $20+/mo with Pro + DB | ~$5-15/mo all-in |
| Long-running tasks | 60-300s function limit | No limit, persistent server |
| Local dev parity | Different from production | Identical (same Docker container) |

Railway wins on every dimension that matters for this app. Vercel is better for static-heavy public sites; this is a dynamic, data-driven, server-side-heavy app.

### Playwright over puppeteer / wkhtmltopdf / reportlab

- We already proved the HTML-to-PDF approach works (the static PDF I built uses exactly this)
- Renders the dashboard as PDF using the same code that renders it in the browser
- Single source of truth: dashboard HTML *is* the PDF
- The alternative (regenerate PDF in Python with reportlab) means maintaining two implementations of the report

### Auth: NextAuth (Auth.js v5) with email + password

- Self-hosted, no third-party SaaS cost
- Supports email + password, magic links, OAuth (future-proofs SSO if a client wants it)
- Stores users in our Postgres, no external dependency
- Battle-tested, well-documented for Next.js App Router

## Service topology

```
                    ┌──────────────────────────────────┐
                    │  Railway Project                 │
                    │  ┌────────────────────────────┐  │
       Internet ────┼──┤  Next.js Service           │  │
                    │  │  - Pages (admin + client)  │  │
                    │  │  - API routes              │  │
                    │  │  - PDF export              │  │
                    │  └──────────┬─────────────────┘  │
                    │             │                    │
                    │             ▼                    │
                    │  ┌────────────────────────────┐  │
                    │  │  Postgres                  │  │
                    │  └────────────────────────────┘  │
                    │                                  │
                    │  ┌────────────────────────────┐  │
                    │  │  Volume (uploaded files)   │  │
                    │  └────────────────────────────┘  │
                    └──────────────────────────────────┘
```

Single Next.js service handles everything. Postgres for relational data. Volume for raw Excel files (we keep them for audit / re-parsing).

## Data flow

### Upload flow (Sakneen admin)

```
Youssef logs in at /admin
  → drags Excel file into upload zone
  → POST /api/admin/uploads (multipart)
    → save file to volume (uploads/{client_id}/{timestamp}.xlsx)
    → parse with xlsx library
    → normalize dates (DD-MM-YYYY mess we already solved)
    → validate row shape, row count, dedup logic
    → insert eoi_uploads row (status=draft)
    → insert N eoi_records rows linked to upload_id
  → preview page shows: row count, date range, totals, "looks right? publish or discard"
  → Youssef clicks Publish
    → PATCH /api/admin/uploads/:id { status: 'published' }
    → mark prior published upload for same client as 'superseded'
  → done, client dashboard now shows new data
```

### View flow (Paragon user)

```
Fouad opens paragon.sakneen.com
  → redirect to /login if no session
  → login with email + password
  → redirect to /dashboard (their client_id is on session)
  → dashboard server-component fetches latest published upload + records for client_id
  → renders summary, status breakdown, daily charts, type distribution, ledger table
  → client-side hydration enables: hover tooltips, date filters, count/value toggle, type/status filters
  → polls /api/dashboard/:client_id/data every 5 minutes for fresh data
  → "Download PDF" button → GET /api/dashboard/:client_id/pdf → returns PDF blob
```

### PDF generation flow

```
GET /api/dashboard/:client_id/pdf
  → fetch latest published data for client (same as dashboard)
  → spin up Playwright browser
  → navigate to /print/:client_id (an internal route that renders the print-mode HTML, same as static PDF I built)
  → page.pdf({ format: 'A4', printBackground: true })
  → return PDF buffer with appropriate headers
```

The `/print/:client_id` route is the EXACT same HTML structure as the static PDF reference. Reuses the same SVG charts (regenerated server-side from current data via matplotlib or sharp+chart-rendering library).

## Environments

- **Local dev:** `pnpm dev`, local Postgres via Docker Compose, hot reload
- **Preview:** Railway preview deployments per PR (auto-created on push)
- **Production:** Railway main branch deploy, custom domain `paragon.sakneen.com` (or chosen domain)

## Why NOT a worker service for PDF

You might think PDF generation should be a separate worker. It shouldn't, for MVP:
- PDF generation is on-demand (user-triggered), not background-queued
- Takes 2-4 seconds, fine for a synchronous request with a loading spinner
- One service is operationally simpler

If PDF generation becomes a bottleneck later (lots of concurrent downloads), promote it to a worker then. Don't pre-optimize.

## Why NOT websockets / SSE for real-time

Polling every 5 minutes is enough for daily-update data. Websockets would be over-engineering for MVP. v2 candidate when:
- Sakneen platform integration goes live and uploads are continuous
- Or clients ask for it explicitly

## Storage

- **Postgres:** users, clients, uploads metadata, eoi_records, audit log
- **Railway volume:** raw Excel files at `/data/uploads/{client_id}/{upload_id}.xlsx`
- **No object storage / S3 needed for MVP.** Volume is fine for hundreds of files. Migrate to S3/R2 if storage grows past 10GB.

## Observability

For MVP, keep it simple:
- Railway's built-in logs and metrics
- Sentry for error tracking (free tier covers us)
- PostHog (Sakneen already uses it) for product analytics: who logs in, who downloads PDFs, what they filter by
- Skip APM, distributed tracing, custom dashboards until needed

## Security baseline

- HTTPS only (Railway handles certs)
- HttpOnly + Secure cookies for sessions
- CSRF tokens on mutating routes
- Rate limit login endpoint (5 attempts per 15 min per email)
- Bcrypt for password hashing (NextAuth default)
- Postgres connection over TLS
- Strict CORS: API routes only accept same-origin
- All admin routes behind admin role check, all client routes scoped to client_id
- File upload size limit: 10MB (Excel files we've seen are <500KB)
- File type validation: only `.xlsx` and `.xls` accepted
- No exposing internal IDs in URLs where avoidable; use opaque tokens for client-facing share links

## What we're explicitly NOT doing for MVP security

- 2FA (add in v2 if any client demands it)
- IP allowlisting (offer in v2 as enterprise feature)
- Audit-log UI (the `audit_log` table exists, but we don't surface it)
- SOC2 prep (revisit when we have 5+ clients)
