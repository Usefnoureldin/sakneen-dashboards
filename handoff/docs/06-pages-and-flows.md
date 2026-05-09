# 06 — Pages & Flows

## Route map

```
PUBLIC
/                         → marketing splash (or redirect to /login). Keep minimal for MVP.
/login                    → unified login (detects role, routes to /admin or /dashboard)

ADMIN (sakneen_admin role)
/admin                    → admin home: list of clients, last upload status per client
/admin/clients/:slug      → per-client view: upload history, current published, users
/admin/clients/:slug/upload → upload flow (drag Excel)
/admin/clients/:slug/upload/:uploadId/preview → preview before publish
/admin/clients/:slug/users → manage client users (add, deactivate)
/admin/users              → manage Sakneen admin users
/admin/audit              → audit log (lite, just a table for MVP)

CLIENT (client_user role)
/dashboard                → main dashboard (client_id derived from session)
/print                    → server-rendered print version (Playwright loads this)

API
POST /api/auth/login                                    → email + password login, sets session cookie
POST /api/auth/logout                                   → clear session
GET  /api/auth/me                                       → current user

POST /api/admin/clients                                 → create client (sakneen_admin only)
GET  /api/admin/clients                                 → list clients
GET  /api/admin/clients/:slug                           → client detail

POST /api/admin/clients/:slug/uploads                   → upload Excel (multipart)
                                                          → parses, creates draft, returns preview data
GET  /api/admin/clients/:slug/uploads                   → upload history for client
GET  /api/admin/clients/:slug/uploads/:id               → single upload detail
PATCH /api/admin/clients/:slug/uploads/:id              → publish or discard ({ status: 'published' | 'discarded' })

POST /api/admin/clients/:slug/users                     → invite/create client user
DELETE /api/admin/clients/:slug/users/:userId           → deactivate user

GET  /api/dashboard/data                                → current client's published data (uses session client_id)
                                                          → returns aggregated KPIs + daily series
GET  /api/dashboard/pdf                                 → returns PDF blob for current client's data
                                                          → uses Playwright to render /print
```

All admin routes check `req.session.user.role === 'sakneen_admin'`.
All dashboard routes derive client_id from `req.session.user.client_id` and never accept client_id from URL/body.

## Page-by-page detail

### `/login`

Single page. Sakneen Blue background OR clean white with Sakneen Blue header bar (pick one — recommend white for accessibility, blue accent only).

Layout:
- Centered card, max-width ~400px
- "sakneen" wordmark at top
- Form: email, password, "Sign in" button
- "Forgot password?" link below (out of scope for MVP — link can be a `mailto:youssef@sakneen.com` for now)
- Error state inline below form

After successful login:
- If `role === 'sakneen_admin'` → redirect to `/admin`
- If `role === 'client_user'` → redirect to `/dashboard`

### `/admin`

The Sakneen home for admins.

Layout:
- `<PageHeader>` (sakneen | Enterprise)
- Section eyebrow: "Clients", H1: "Active client dashboards"
- A list (cards or table) of all clients with:
  - Client name + slug
  - Last published upload date
  - Number of EOIs in latest published
  - "Open" button → `/admin/clients/:slug`
  - "Upload" button → `/admin/clients/:slug/upload`
- "Add new client" button (top-right, button style: charcoal bg, white text, rounded)

For MVP only Paragon Adeer exists, so this is a list of one. That's fine.

### `/admin/clients/:slug`

Per-client management page.

Layout:
- `<PageHeader>` with crumb "Clients · {Client Name}"
- Big H1 with client display name
- Subhead with last upload info
- Three sections:

**Section 1: Current published data**
- Mini summary card: total EOIs, total value, date range, published date
- Link to "View what client sees" (opens `/dashboard` impersonating, or just opens the client URL — TBD)

**Section 2: Upload history**
- Table: date uploaded, status badge (draft/published/superseded/discarded), file name, row count, value, uploaded by, actions
- Action buttons: "Preview" (drafts), "Publish" (drafts), "Discard" (drafts), "Republish" (superseded)
- Top-right "New upload" button → `/admin/clients/:slug/upload`

**Section 3: Client users**
- List of users in this client
- Email, name, role, last login, status
- "Invite user" button → opens form
- Right-side "Deactivate" link per user

### `/admin/clients/:slug/upload`

The upload flow.

Step 1 — Upload zone:
- Big drag-drop zone (warm-cream bg, dashed slate-200 border, rounded-xl)
- Centered: cloud-upload icon (Lucide), "Drop Excel file here", subhead "or click to browse"
- Accept: `.xlsx`, `.xls`
- On drop / file selection: show file name, size, "Upload" button

On submit (multipart POST to `/api/admin/clients/:slug/uploads`):
- Server parses file
- If valid: redirect to `/admin/clients/:slug/upload/:uploadId/preview`
- If invalid: stay on page, show error inline (terracotta banner with error message)

### `/admin/clients/:slug/upload/:uploadId/preview`

Preview before publishing. CRITICAL: this is the main quality gate.

Layout:
- `<PageHeader>` with crumb "{Client} · Upload preview"
- H1: "Preview upload"
- Subhead: "Review the data, then publish to make it visible to {client name}."

Then a STAGED VIEW of what the client will see:
- Top stats cards (same as dashboard hero): total count, total value, date range, days
- Status breakdown cards
- Daily count chart (small, no interactivity needed, just visual confirmation)
- Type distribution mini view

If parse warnings exist, show them above the preview as an info banner:
- Slate-100 bg, slate-700 text
- Mono uppercase "PARSING NOTES"
- List of warnings (e.g. "12 dates normalized from datetime", "3 blank rows skipped")

Sticky bottom action bar:
- Left: "Discard" button (slate-100 bg, slate-700 text)
- Right: "Publish to {Client}" button (sakneen-blue bg, white text, larger)
- Confirm dialog on publish: "This will replace the currently published report. Continue?"

### `/admin/audit`

Simple table view of audit log. Filterable by user, by client, by action. MVP just needs the table to exist; fancy filtering is a v2 enhancement. Default view: last 100 entries.

### `/dashboard`

THE main client-facing page. Mirror the PDF structure but interactive.

Layout (top to bottom):

**1. Header bar**
- Left: sakneen logo
- Right: client name (e.g. "Paragon Adeer"), user dropdown (logout)

**2. Title section**
- Eyebrow: "Daily EOI Tracker"
- H1: "Expression of Interest Report"
- Subhead with date range and "Last updated {time ago}"

**3. Filters bar (sticky on scroll, optional)**
- Date range selector: dropdown with "Last 7 days", "Last 30 days", "Full window", "Custom"
- Status filter: chips for All / Approved / Pending / Rejected (multi-select)
- Type filter: chips for All / Residential / Admin
- Right side: "Download PDF" button (sakneen-blue, white text)

**4. Hero stats** (same as PDF page 2)
- Two big cards side by side: Total EOIs (sakneen-blue), Total Value (terracotta)

**5. Stat grid** (4 small cards)
- Active Days, Avg/Active Day, Peak Day, Avg Daily Value

**6. Status breakdown** (3 status cards)
- Approved / Pending / Rejected with %, count, value

**7. Status doughnut chart**
- Same data as the cards above, visual form

**8. Daily charts**
- Toggle (top-right): "Count" / "Value" — switches the chart below
- Bar chart of daily totals
- Below it, "Show by status" toggle that flips to stacked view

**9. Type distribution**
- Two side-by-side cards: Residential / Admin
- Below, the horizontal stacked bar chart

**10. Daily ledger table**
- Same as PDF page 6
- Sortable column headers (click date / count / value to sort)
- Optional: search box that filters by date
- Pagination if rows exceed ~30; otherwise show all

**11. Footer**
- "Powered by Sakneen" wordmark, small
- Last updated timestamp
- Link to download PDF (in case they missed the top button)

### Interactive behaviors on dashboard

- All charts: hover for tooltip with exact date + values
- Date filters: instant client-side filtering of an already-fetched dataset (no re-fetch needed for date ranges within the published window)
- Status / type filters: apply across all charts and the table simultaneously
- Auto-refresh: poll `/api/dashboard/data` every 5 minutes; if response has newer `published_at`, prompt user with a small banner "New data available · Refresh" rather than reloading silently (Youssef's preference: don't surprise users with content shifts)
- Print friendly: when user prints from browser (Cmd+P), use a print stylesheet that matches the PDF (or just direct them to the Download PDF button)

### `/print`

Server-rendered HTML that's a 1:1 match for the static PDF reference.

This route:
1. Reads session, gets client_id
2. Fetches latest published data for that client
3. Renders a multi-page HTML structure with `page-break-after: always` on each section
4. Charts as inline SVGs (server-generated; do NOT use Recharts here because it's React + client-only)
5. Same fonts, colors, structure as the static PDF

This page is loaded by Playwright in headless mode. It's not meant for human browsing (though humans CAN browse to it; it just looks weird without paper boundaries).

The `/api/dashboard/pdf` route opens this URL in Playwright and prints to A4 PDF.

## Interaction details

### Auto-refresh behavior

Every 5 minutes:
```
fetch /api/dashboard/data
if (response.published_at > current.published_at) {
  show banner: "New data available — Refresh now" with two buttons (Refresh / Dismiss)
}
```

Don't auto-replace; let user opt in. Reason: someone in a meeting looking at numbers shouldn't have them shift mid-sentence.

### PDF download

Click "Download PDF":
1. Show inline loading indicator next to the button: "Generating..."
2. Call `GET /api/dashboard/pdf`, expect a PDF blob response
3. Trigger browser download with filename `{ClientName}_EOI_Report_{YYYYMMDD}.pdf`
4. Reset button state

If generation fails: show inline error "Could not generate PDF. Try again or contact support."

### Filter state in URL

Date range, status, type filters should be reflected in URL query params so a Paragon user can share a specific filtered view. e.g. `/dashboard?range=last7&status=approved`.

## Authentication flow detail

Use NextAuth (Auth.js v5) with credentials provider:

```typescript
// auth.config.ts
{
  providers: [
    Credentials({
      async authorize({ email, password }) {
        const user = await db.users.findOne({ email, active: true });
        if (!user) return null;
        if (!await bcrypt.compare(password, user.password_hash)) return null;
        await db.users.update(user.id, { last_login_at: new Date() });
        await audit.log({ user_id: user.id, action: 'login' });
        return { id: user.id, email: user.email, role: user.role, client_id: user.client_id };
      }
    })
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt: ({ token, user }) => user ? { ...token, ...user } : token,
    session: ({ session, token }) => ({ ...session, user: { ...session.user, role: token.role, client_id: token.client_id } })
  }
}
```

Middleware to enforce route access:

```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  const session = await auth();
  const path = req.nextUrl.pathname;

  if (path.startsWith('/admin') && session?.user?.role !== 'sakneen_admin') {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (path.startsWith('/dashboard') && session?.user?.role !== 'client_user') {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}
```

## Validation patterns

Use Zod everywhere data crosses a trust boundary (API input, parsed Excel rows, env vars).

```typescript
const UploadParseSchema = z.object({
  count: z.number().int().min(1),
  unit_type: z.enum(['Residential', 'Admin']),
  status: z.enum(['approved', 'pending', 'rejected']),
  eoi_date: z.date(),
  amount_egp: z.number().int().min(0),
});
```

## What I'm intentionally leaving simple for MVP

- No "compare to last week" — v2
- No bookmarking/saving filter combinations — v2
- No drilldown from chart bar to filtered table — v2 nice-to-have
- No CSV export of filtered data — v2 (PDF download covers reporting need)
- No team management beyond add/deactivate user — v2
- No notification settings (email me when new data published) — v2
