# 07 — Build Plan

> 2-week MVP. Single engineer in Claude Code. Daily working sessions assumed.

## Day-by-day plan

### Day 1: Project skeleton

**Goals:**
- Repo created, dependencies installed, runs locally
- Postgres running locally via Docker Compose
- "Hello world" page renders with DM fonts loaded

**Tasks:**
- `pnpm create next-app@latest sakneen-dashboards --typescript --tailwind --app --src-dir --import-alias "@/*"`
- Install: `pnpm add drizzle-orm postgres @auth/drizzle-adapter next-auth@beta zod bcryptjs date-fns recharts`
- Install dev: `pnpm add -D drizzle-kit @types/bcryptjs playwright`
- Set up Docker Compose with Postgres 16
- Configure Tailwind with the design tokens from `docs/05-design-system.md`
- Create base layout with DM fonts loaded
- Create homepage that just shows "sakneen" wordmark in correct font/color, sanity check

**Definition of done:**
- `pnpm dev` runs the app at localhost:3000
- Homepage shows "sakneen" in DM Sans 700, color `#2109C4`
- Postgres reachable at localhost:5432

### Day 2: Schema and migrations

**Goals:**
- Database schema defined, migrations run, seed data inserted
- Drizzle ORM working

**Tasks:**
- Define schema in `src/db/schema.ts` per `docs/04-data-model.md`
- Generate migration: `pnpm drizzle-kit generate`
- Run migration: `pnpm drizzle-kit migrate`
- Write seed script: insert Paragon Adeer client + Youssef admin user
- Verify with a script that queries the DB

**Definition of done:**
- All 5 tables exist in local Postgres with correct constraints
- `clients` has Paragon row, `users` has Youssef row
- One simple query works end-to-end (e.g. "list clients")

### Day 3: Auth

**Goals:**
- Login page works, session persists, role-based redirects work, middleware blocks unauthorized routes

**Tasks:**
- Configure NextAuth with credentials provider per `docs/06`
- Build `/login` page (just the form, basic styling)
- Build `/api/auth/[...nextauth]` handler
- Add `middleware.ts` for route protection
- Build placeholder `/admin` and `/dashboard` pages (just text "Admin home" and "Dashboard")
- Test: Youssef logs in, lands on `/admin`. Direct nav to `/dashboard` redirects to `/login`. Direct nav to `/admin` while logged out redirects to `/login`.

**Definition of done:**
- Youssef can log in and see `/admin`
- Logout works and clears session
- Unauthorized access redirects correctly

### Day 4: Excel parsing (the hardest day)

**Goals:**
- Excel upload endpoint works
- Parse logic handles the date-format mess correctly
- Validation rules from `docs/04` enforced

**Tasks:**
- `pnpm add xlsx` (or `exceljs`, pick one — `xlsx` is fine for read-only)
- Write `lib/excel-parser.ts` with the parsing logic from `docs/04-data-model.md`
- Write tests against the reference file in `reference/sample.xlsx` — should produce 638 rows, date range 09 Apr - 04 May 2026
- Build `POST /api/admin/clients/:slug/uploads` route
- Save raw file to `/data/uploads/{client_id}/{upload_id}.xlsx` (use Railway volume; locally just use `./uploads/`)
- Insert `eoi_uploads` row + N `eoi_records` rows in a transaction
- Return upload_id and parse summary

**Definition of done:**
- Sample Excel uploads via API (test with curl or Postman)
- 638 records appear in DB with correct dates
- Parse warnings logged for inconsistent date formats
- Bad files rejected with helpful error

### Day 5: Admin upload UI

**Goals:**
- Drag-drop UI works
- Preview page shows correct stats
- Publish flow works end-to-end

**Tasks:**
- Build `/admin/clients/:slug/upload` page with drag-drop zone (use `react-dropzone`)
- On drop, POST to upload API
- On success, redirect to preview page
- Build `/admin/clients/:slug/upload/:id/preview` page
- Show summary stats from the parsed data
- Add Publish / Discard buttons
- Wire up `PATCH /api/admin/clients/:slug/uploads/:id` to handle status transitions
- Make sure publishing one supersedes the prior published

**Definition of done:**
- Youssef drags Excel, sees preview, clicks Publish
- DB shows new published upload, prior is superseded
- Discard removes the draft

### Day 6: Admin dashboard / client management

**Goals:**
- `/admin` shows client list with last upload status
- `/admin/clients/:slug` shows upload history + users
- User management (invite, deactivate) works

**Tasks:**
- Build `/admin` page with client list (cards or table)
- Build `/admin/clients/:slug` with three sections per `docs/06`
- Build user invite form (modal or new page)
- Implement `POST /api/admin/clients/:slug/users` to create users
  - Generate temp password, email it (or just return it for MVP — see Open Decisions)
- Implement deactivate user

**Definition of done:**
- Youssef can see Paragon's status and history at a glance
- Youssef can add Fouad as a user
- Youssef can deactivate a user

### Day 7: Buffer day / catch-up / polish week 1

Use this for:
- Anything from days 1-6 that ran over
- Bug fixes in the upload flow
- Initial Railway deploy and domain setup (don't wait until end of week 2)
- Get the email sender configured and test invitation flow

If everything is on track, start day 8 work.

### Day 8: Dashboard data layer

**Goals:**
- `/api/dashboard/data` returns fully aggregated data for client
- Server component on `/dashboard` fetches it, renders top stats

**Tasks:**
- Write `lib/aggregations.ts` with all the derivations from `docs/04` (totals, status breakdown, type breakdown, daily series)
- Build `GET /api/dashboard/data` route
- Build `/dashboard` page server component that fetches and renders the hero stats + status cards
- Match `docs/05-design-system.md` exactly for card styling

**Definition of done:**
- Fouad logs in, sees the hero stats and status breakdown
- Numbers match what's in the DB

### Day 9: Dashboard charts

**Goals:**
- All charts on `/dashboard` work and look right

**Tasks:**
- Set up Recharts theme matching design tokens
- Build `<DailyCountChart>` (basic bar)
- Build `<DailyValueChart>` (basic bar, terracotta)
- Build `<DailyCountStackedChart>` (stacked by status)
- Build `<DailyValueStackedChart>` (stacked by status)
- Build `<StatusDoughnut>` (pie with cutout)
- Build `<TypeCompositionChart>` (horizontal stacked bar)
- Custom Tooltip component matching Sakneen voice

**Definition of done:**
- All charts render correctly with sample data
- Hover tooltips show meaningful info
- Visually matches the static PDF

### Day 10: Dashboard interactivity

**Goals:**
- Filters work, Count/Value toggle works, table is sortable

**Tasks:**
- Build filters bar (date range, status chips, type chips)
- URL state for filters (use Next.js searchParams)
- Make filters apply to all charts + table simultaneously
- Build daily ledger table with sortable headers
- Add Count/Value toggle on daily charts
- Add "Show by status" toggle to switch to stacked

**Definition of done:**
- Date range filter changes what charts show
- Status filter chips work and combine logically
- Filter state survives page reload (URL params)

### Day 11: PDF generation route

**Goals:**
- "Download PDF" button works and produces a file matching the static PDF reference

**Tasks:**
- Build `/print` page (server-rendered HTML mirroring static PDF)
- Generate charts as inline SVGs server-side (use `chart-svg` or roll your own with d3-shape)
  - Alternative: render Recharts to SVG using `recharts-to-svg` or screenshot with Playwright (latter is less work)
- Build `GET /api/dashboard/pdf` route that uses Playwright to load `/print` and produce A4 PDF
- Wire up download button on `/dashboard`
- Test: PDF output should be byte-comparable to my reference (within reason)

**Definition of done:**
- Click button → PDF downloads
- PDF matches static reference visually
- Generation takes < 5 seconds

### Day 12: Auto-refresh + polish

**Goals:**
- Dashboard polls for updates
- Loading states / empty states / error states all done
- Mobile responsive

**Tasks:**
- Implement 5-minute polling on `/dashboard`
- "New data available" banner with refresh / dismiss
- Skeleton loaders for initial page load
- Empty state for clients with no published data
- Error states for API failures
- Mobile breakpoints: cards stack, charts shrink, hide stacked-status charts on mobile

**Definition of done:**
- Open dashboard in two tabs, publish from another tab, banner appears in tab 1
- Mobile view doesn't have horizontal scroll

### Day 13: Production deploy + smoke test

**Goals:**
- App live on Railway with custom domain
- All env vars correct
- Real Paragon users seeded
- End-to-end smoke test passes

**Tasks:**
- Verify Railway service is configured per `docs/08-deployment.md`
- Wire custom domain (e.g. `paragon.sakneen.com`)
- Run production migrations
- Seed production: Paragon client, Youssef admin, 2-3 Paragon users
- Email each user their temp password
- Smoke test: Youssef uploads sample, Paragon user logs in, sees data, downloads PDF

**Definition of done:**
- Production URL works
- All real users can log in
- Upload + view + download PDF round-trip works in production

### Day 14: UAT with Youssef and buffer

- Demo with Youssef in detail
- Fix anything he catches
- Have him do a real upload with current-day Paragon data
- He demos to Fouad / Paragon team
- Document any issues for v2

## What's the minimum I'd ship if I had to cut?

If days 7-14 compress, here's the cut order:

**Cut last (must-haves):**
- Auth, upload flow, basic dashboard with hero + table, PDF download

**Cut next-to-last:**
- All charts (table-only fallback works)
- Multi-tenancy (hardcode Paragon)

**Cut first (nice-to-haves):**
- Audit log UI
- User management UI (just seed users via SQL)
- Filters / sorting (show all data, no filters)
- Auto-refresh (require manual refresh)
- Mobile responsive

If everything's on fire by day 10, ship the cut version on day 10, then iterate.

## Things to test on every build

- Youssef can log in, upload, publish, log out
- Paragon user can log in, see correct data, log out
- Cross-account: Paragon user CANNOT see another client's data even if they manipulate URLs
- Admin user without `client_id` doesn't get a dashboard
- PDF download produces a valid PDF file
- Refreshing during loading doesn't break anything
