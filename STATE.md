# STATE

> Living status doc. Update when something ships, breaks, or changes direction.
> Source of truth for "where are we?" so a fresh Claude session (or human) can catch up in 60 seconds.
> Last updated: 2026-05-11 (session 3 - PDF/print + mobile chart fixes)
>
> Deploys: Railway auto-deploys on push to `main` (Railway GitHub App, requires Hobby plan or higher — both wired 2026-05-10). No more `railway up` from local.
> Live: https://paragonadeer-production.up.railway.app

## TL;DR

MVP shipped, major iteration on real Sakneen export data, end-to-end verified in production. Schema and parser match the live wide-schema export (14 cols, mixed serial/text dates, `canceled` status). Dashboard has 4 new sections (Direct vs Indirect, Nationality, Bulk Units, Broker Performance), clickable bulk cards, sticky nav, mobile-optimized layout (initials avatar, 2-col status grid, fixed-position date picker, shorter title). PDF pre-generated on publish so client downloads are ~0.3s instead of 3-14s. Brand: transparent-PNG logo + light-blue brand accent (terracotta → `#4A6CF7`) + DM Serif client co-brand in nav. New date-range picker with quick chips (Last 7 days, YTD, last 6 months) + 2-month range calendar.

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

- `excel_uploads/` (real customer EOI exports) and `public/*.pdf` (generated reports with customer data) are now in `.gitignore`. `.dockerignore` mirrors the same rules so they don't ship in the production image either.
- `.gitignore` also catches `*password*` and `*credentials*` filenames.
- Decision #2 in `09-open-decisions.md` is no longer accurate. The "standardized format" agreed with the export team never rolled out; we adapted to the live wide schema instead. The doc should be updated.

## Session 2026-05-10 part 2: prod deploy + UI polish

### Production deploy

- Manual `railway up` with `74f290c` to bring the new code live (Railway service `paragonadeer` in project `sakneen-eoi-dashboards`, region sfo, volume `/data` 49 MB / 500 MB).
- GitHub auto-deploy connected via Railway GitHub App after upgrading the workspace from Trial → Hobby plan ($5/mo). Verified end-to-end with a test push (`d4327bb`) that triggered a build at +80s.
- All 6 prod user passwords rotated via `pnpm db:set-passwords` against prod DB. Source of truth: `secrets/passwords.json` (gitignored). Re-run the script to rotate.

### UI polish

- **Sticky nav** with `sticky top-0 z-30` + `bg-white/80 backdrop-blur` on dashboard + admin headers (`5681a76`).
- **Brand accent shift**: `--color-terracotta` swapped from `#C84B31` to `#4A6CF7` (light blue). Affects hero "Total Value Collected" card, eyebrow tags, "PRIMARY"/"IN-HOUSE" pills, Type composition Admin segment, value-mode chart bars. Charts split the constant into `ACCENT_BLUE` + `REJECTED_RED` so the Rejected status keeps its red. (`57f73b2`)
- **Featured cards** (Residential TypeCard, Direct ChannelCard) switched from `bg-warm-cream` (invisible against page bg) to `bg-white border-slate-200`. Differentiation now lives in the colored pill.
- **Date-range picker** (`react-day-picker` v10): single popover button replaces the old chip-group + inline date inputs. Quick Select Month chips (last 6 months) + 2-month calendar with range mode (`a76a7a1`). Plus quick chips: **Last 7 days** (always visible), **YTD** (desktop only) (`11d3608`).
- **Mobile UX** (`8f4bfa3`):
  - Hero title shortens to "EOI Report" below `sm`
  - Status chips become a 2-col grid (4 chips on 2 rows) on mobile
  - Title section uses `items-center` so the Download PDF button vertically centers against the title block
  - Date picker switches to fixed positioning (`inset-x-4 top-24`) and 1-month layout on mobile
  - Navbar replaces the small `PARAGON ADEER` mono tag with **DM Serif Display** in charcoal, separated from the logo by a thin vertical divider — reads as a co-brand
- **Mobile user menu** (`446295c`): Sign out button on mobile is replaced with a 36px Sakneen-blue circular avatar showing initials (FH for Fouad Harraz, etc). Tap → dropdown with name + email + Profile link + Sign out. Desktop unchanged.

## Session 2026-05-11: PDF realignment to reference + mobile chart polish

### PDF print template

The generated PDF had drifted from the static reference (`public/Paragon_Adeer_EOI_Report.pdf`). Cover was rendering on a white sheet, Type Composition bars on page 5 were both blue with no labels, daily charts on pages 3-4 clipped the last x-axis date. Fixed in `20903d0`:

- `@page { margin: 14mm }` → `margin: 0`; moved the inset to per-page padding so the cover can paint edge-to-edge. `.page-cover` now `width/height: 210x297mm`, `box-sizing: border-box`, solid Sakneen blue, `print-color-adjust: exact`.
- Cover meta row tightened to `font-size: 11px; white-space: nowrap` so the reporting date range stays on one line in the 3-column footer.
- `PrintTypeBar`: Admin segment switched from `ACCENT_BLUE` to `REJECTED_RED` so the split is visible against the Sakneen-blue Residential segment. Added centered `LabelList` percent labels and a `%` x-axis tick.
- `PrintDailyChart`: x-axis ticks `angle={-45}`, `textAnchor="end"`, `interval={0}`, `height={36}` so every date label fits and "09 May" stops clipping. Count chart gets per-bar value labels; Value chart switched to terracotta fill.
- New `scripts/regen-pdf.ts` for one-shot PDF regen on any uploadId (no status mutation). Run: `set -a; source .env.local; set +a; npx tsx scripts/regen-pdf.ts <uploadId> http://localhost:3001`.

### Dashboard mobile

- `TypeCompositionBar` on the unit-type card was rendering with ~120px of fixed left gutter (60px YAxis width + 60px chart left margin), so on mobile the bars only filled the right half of the card. Added a `useIsMobile()` matchMedia hook; on `<640px` the y-axis label shortens to "Count"/"Value", the gutter drops to 40px, and percent labels render inside each bar segment via `LabelList`.

### Prod follow-up

The fix is in code but the published Paragon upload still has its old cached PDF on disk (`pdf_path` set, file exists, fast-path serves it). To pick up the new design in prod, either re-publish the upload from `/admin` (regenerates automatically) or run `scripts/regen-pdf.ts` against the prod DB. Running the script from local would need prod `DATABASE_URL` exported — simpler to republish from the admin UI.

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

- **Forgot-password flow** parked. Will use Resend for sending reset links. Need: verified `EMAIL_FROM` on a sakneen.com subdomain (SPF/DKIM), a `password_reset_tokens` table, /forgot + /reset pages, audit + rate limit. Half-day of work.
- **Custom domain** `paragonadeer.sakneen.com` not configured. Add via Railway service Settings → Networking → Custom Domain, then CNAME in DNS. 5-min job. Tenant resolution code in `src/lib/tenant.ts` already picks up the slug from the subdomain.
- The existing prod upload from before today's session predates the 5 new record columns (`bulk_eoi_id`, `eoi_category`, etc), so its 4 new dashboard sections are empty. Re-uploading the May 9 (or current) Excel via /admin and clicking Publish populates everything.

## How to update this doc

When you ship something material, append a one-liner under the right section and bump the "Last updated" date at the top. Don't let this drift — `git log` is precise but slow to scan.
