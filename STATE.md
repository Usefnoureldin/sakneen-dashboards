# STATE

> Living status doc. Update when something ships, breaks, or changes direction.
> Source of truth for "where are we?" so a fresh Claude session (or human) can catch up in 60 seconds.
> Last updated: 2026-05-10 (session 2)

## TL;DR

MVP shipped + a major iteration on real Sakneen export data. Schema and parser now match the live wide-schema export (14 cols, mixed serial/text dates, `canceled` status, blank brokerage rows). Dashboard gained 4 new sections (Direct vs Indirect, Nationality, Bulk Units, Broker Performance) + clickable bulk cards. PDF is pre-generated on publish so client downloads are sub-second instead of 3-14 seconds. Sakneen brand swapped from wordmark to transparent-PNG logo across header, admin, login, and footer.

## Build plan progress

| Day | Goal | Status | Commit(s) |
|---|---|---|---|
| 1 | Skeleton, Postgres, fonts | done | `cd0638a` |
| 2 | Schema, migrations, seed | done | `6b9dc88` |
| 3 | Auth, middleware, role redirects | done | `951f989` |
| 4 | Excel parser + upload API | done | `e9c96b7` |
| 5 | Admin drag-drop upload + preview + publish | done | `06e921c`, `84ad76d` (legacy auto-convert opt-in) |
| 6 | Admin client/user management + audit log UI | done | `db412b6`, `537cd6f` (audit wiring) |
| 7 | Buffer | n/a (rolled into deploy week) |
| 8 | Dashboard data layer | done | `8b118af` |
| 9 | Charts | done | `8b118af` |
| 10 | Filters / interactivity | done | `8b118af` |
| 11 | PDF generation (Playwright) | done | `1782229`, `a92d8c2` (proxy host fix) |
| 12 | Auto-refresh + polish | done | `8b118af` |
| 13 | Railway prod deploy | done | `c77e60b` + 6 deploy fixes |
| 14 | UAT with Youssef + Paragon | unverified, no commit signal |

## Beyond plan (post-MVP additions)

- Production hardening: rate limit, force-logout, `/api/health`, `/profile`, CI, backups, webpack build (`f912b2a`)
- Clickable status + type cards open detail modal on dashboard (`258490c`)
- `pnpm db:set-passwords` syncs user passwords from `secrets/passwords.json` (`eab881f`)

## Session 2026-05-10: real-export + new sections + perf

### Schema (4 new migrations: 0001-0004)

- `0001` Add `canceled` to the `eoi_records.status` CHECK (was 3 statuses, now 4).
- `0002` Add 5 columns to `eoi_records`: `bulk_eoi_id`, `eoi_category`, `eoi_source`, `nationality`, `brokerage_name`. All nullable.
- `0003` Change `bulk_eoi_id` from bigint to text — real Bulk EOI IDs are mixed: ~25% are numbers (e.g. `35096`), ~75% are strings like `"1899-1"`. Bigint silently nulled the strings.
- `0004` Add `pdf_path` text column to `eoi_uploads` (cached PDF location).

### Parser

- Replaced the strict 5-column parser + opt-in legacy converter with a single name-based parser that natively reads the wide Sakneen export (14+ columns).
- Accepts dates as text DD-MM-YYYY, text DD/MM/YYYY, or Excel serial (with the day/month swap to undo Excel's mis-parse of Egyptian dates as US).
- Drops rows missing unit type or with unsupported status; surfaces drop counts as warnings on the upload preview.
- Removed the "Treat as legacy format (auto-convert)" checkbox from the admin upload UI — every real export needed it, so it's just the default now.

### Dashboard (4 new sections + canceled threading)

- Status section now has 4 cards (Approved / Pending / Rejected / Canceled) and 4-segment doughnut + stacked bars + ledger column. New `canceled` design tokens (gray) added to `globals.css`.
- **Direct vs Indirect** card with nested breakdown. Direct shows source list (Self-generated, Ambassador, etc.); Indirect shows top 5 brokers (since the source rollup is just "Broker 100%").
- **Nationality** table: top 8 by count + "Other" + "Unknown", with count, value, share, distribution bar.
- **Bulk units** segmentation: 6 buckets (1, 2, 3-5, 6-10, 10-20, 20+) shown as cards + chart with Groups/Value toggle. Cards are clickable, open a modal listing every Bulk EOI ID in that band.
- **Broker performance** horizontal bar chart: top 10 by EOI count + "Other (N brokers)" rollup. Blank brokerage cells grouped as "Direct (in-house)".

All four sections mirrored in the print PDF as new pages 6-9 (daily ledger renumbered to page 10).

### PDF performance (the big perf win)

- Old path: every download cold-launched Chromium, fetched `/print/...`, waited for Recharts to hydrate, generated PDF. ~3-14 seconds per download.
- New path: PDF is generated once at publish time, persisted under `${UPLOADS_DIR}/${clientId}/${uploadId}.pdf`, path saved to `eoi_uploads.pdf_path`. Downloads stream the file: ~0.3s.
- Fallback: if `pdf_path` is missing or the file isn't on disk, the route generates inline and persists for next time. Covers old uploads that predate the change.
- Shared `src/lib/pdf-generator.ts` module used by both the publish action and the route fallback.

### Brand asset

- Sakneen wordmark replaced with the company logo across all 4 in-app surfaces: dashboard header, admin layout header, login page, dashboard footer.
- Source JPG had a white background; built a tsx script using sharp to alpha-key near-white pixels (threshold 235, soft-edge ramp 215-235) and exported `public/logo/sakneen-logo.png` (transparent, 247KB). Original `public/logo/Sakneen Logo.JPG` preserved.
- PDF print pages still use the text wordmark — that's part of the printed-report design contract.

### Important data-handling notes

- `excel_uploads/` (real customer EOI exports) and `public/*.pdf` (generated reports with customer data) are now in `.gitignore`. Don't commit either.
- Decision #2 in `09-open-decisions.md` is no longer accurate. The "standardized format" agreed with the export team never rolled out; we adapted to the live wide schema instead. The doc should be updated.

## What runs where

- **Local dev:** `docker compose up -d` then `pnpm dev`. App at `http://localhost:3000` (3001 if 3000 is busy). Postgres at `localhost:5432`.
- **Production:** Railway (single service + Postgres + volume at `/data/uploads`). See `handoff/docs/08-deployment.md`.

## Open decisions (from `handoff/docs/09-open-decisions.md`)

Decided:
- #1 Domain: `<slug>.sakneen.com`, stage 1 local
- #2 Excel format: ~~standardized DD-MM-YYYY text~~ → **superseded**: parser now natively reads the live wide schema (14 cols, mixed dates, includes `canceled`). The "standardized format" never shipped from the export team. Doc needs update.
- #4 Auth: NextAuth credentials, manual passwords shared out-of-band

Still open (defaults may have been silently applied, confirm before relying on):
- #3 Paragon users beyond Fouad (seed currently has Fouad, Eslam, Omar, Sara — confirm this is the right list)
- #5 Re-upload behavior
- #6 Auto-refresh visibility (banner vs silent)
- #7 PDF filename format
- #8 Cover-page date range when filters applied
- #9 Status filter combinations
- #10 Empty-state copy when no data published
- #11 Audit log retention
- #12 PDF reflects filters or always full report
- #13 Repo visibility (currently public on GitHub — confirm intended)
- #14 Long-term codebase ownership
- #15 v2 trigger

## Known gaps / likely next work

- UAT pass with real Paragon data (Day 14) is unverified
- No `secrets/passwords.json` exists locally; only used in prod via `pnpm db:set-passwords`
- Repo is currently public — may want to flip private (Decision #13)

## How to update this doc

When you ship something material, append a one-liner under the right section and bump the "Last updated" date at the top. Don't let this drift — `git log` is precise but slow to scan.
