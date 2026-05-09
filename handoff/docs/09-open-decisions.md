# 09 — Open Decisions

> These are things Youssef needs to decide before or during the build. ASK before assuming. They're listed roughly in the order they'll come up.

## DECISION 1: Domain structure ✅ DECIDED (revised 2026-05-09)

**Decision:** `<org-slug>.sakneen.com` — per-client subdomain directly off `sakneen.com`. Paragon's URL is `paragonadeer.sakneen.com` (slug = lowercased, despaced organization id from sakneen.com).

**Stage 1 hosting:** Local. Production hosting (Railway, real DNS) deferred until after the local MVP is validated.

**Implications:**
- DNS (later): wildcard `*.sakneen.com` would conflict with whatever is currently at sakneen.com, so dashboard-specific subdomains will be added one at a time, or we move to a wildcard on a dedicated parent. Decide at deploy time.
- Local dev: simulate via `/etc/hosts` entry (`127.0.0.1 paragonadeer.sakneen.localhost`) plus `next.config.js` allowed hosts, OR just use a query param / route segment in dev (`localhost:3000/t/paragonadeer`). Pick at Day 3 when wiring tenant resolution.
- Tenant resolution: parse subdomain in middleware → look up `clients` row by `slug` → set `client_id` on request. Admin portal is the bare hostname (no subdomain).

---

## DECISION 2: Excel format standardization ✅ DECIDED

**Decision (2026-05-09):** Yes, standardization is in progress with whoever owns the export. Parser will be built against the standardized format:

- Dates as text in `DD-MM-YYYY`
- No blank rows
- Fixed column order

**Implication for Day 4:** Skip the date-swap workaround. Treat any non-standard input as a hard parse error with a clear message ("Excel format does not match expected schema, please re-export"). Keep parser strict. If a malformed file shows up before standardization is rolled out everywhere, we reject it loudly rather than silently coercing.

---

## DECISION 3: Paragon users

**Question:** Who at Paragon should have access? Need names and emails. Recommend 2-3 people to start.

**Default if not answered:** Just Fouad Harraz (`fouad@paragonadeer.com` or wherever). Add more later via admin UI.

**Why it matters:** I need real users to seed the production DB before showing them the dashboard.

---

## DECISION 4: Initial password handling for new users ✅ DECIDED (revised 2026-05-09)

**Decision:** Standalone auth via NextAuth credentials provider for Stage 1. Sakneen admin (Youssef) sets the user's password manually; the password is shared with the user out-of-band (in person, WhatsApp, etc.). This is option (c) from the original list.

**Why standalone now:** The "use sakneen.com credentials" path requires sakneen.com to expose an OAuth/OIDC provider, an auth API, or DB access. None of those are ready. Waiting blocks shipping. Standalone unblocks Stage 1; we migrate to sakneen.com SSO post-MVP.

**Context (informs the future migration path):**
- Fouad and team already have accounts on sakneen.com under organization "Paragon Adeer"
- Sakneen platform already has admin roles assigned to sakneen.com users
- Future state: dashboard delegates auth to sakneen.com so users hit `paragonadeer.sakneen.com`, get bounced to sakneen.com to log in if not already, return as authenticated. Same credentials, single sign-on across platform + dashboards.

**Stage 1 implementation (Day 3):**
- NextAuth credentials provider, bcrypt password hashes, session cookie
- Schema: `users` table with `email`, `password_hash`, `role`, `client_id` (null for sakneen admins), `created_at`
- Sakneen admin role: row in `users` with `role='sakneen_admin'` and `client_id=null`. Seed script inserts Youssef.
- Client user role: row with `role='client_user'` and `client_id` pointing at their org. For Paragon, that's the row keyed off org "Paragon Adeer".
- No invite emails. Admin creates user with a chosen password via `/admin/clients/:slug/users` form (Day 6); shares it out-of-band.

**Migration path (post-MVP, when sakneen.com is ready):**
- Add an "Auth provider" toggle per environment
- Implement OIDC client; users with no local password_hash get redirected to sakneen.com instead
- Old standalone users grandfathered in until they switch

---

## DECISION 5: Re-upload behavior

**Question:** If you upload Monday's file twice by mistake, what should happen?

- (a) Each upload becomes a new draft. Publishing one supersedes the prior published version. **Full version history kept.** (recommended)
- (b) Auto-detect duplicate uploads (same row count + same file hash) and prompt "Already uploaded earlier today, skip?"
- (c) Replace silently

**Default if not answered:** (a). It's the right default. Auto-detection is brittle.

---

## DECISION 6: Auto-refresh visibility

**Question:** When new data is published while a Paragon user has the dashboard open:

- (a) Show banner "New data available · Refresh" — user opts in (recommended)
- (b) Refresh silently — they see updated numbers without warning
- (c) Don't auto-refresh; require manual page reload

**Default if not answered:** (a). Avoids the "numbers shifted while I was reading them aloud in a meeting" problem.

---

## DECISION 7: PDF download filename

**Question:** What should the downloaded PDF be called?

- (a) `Paragon_Adeer_EOI_Report_20260505.pdf` (date in filename)
- (b) `Paragon_Adeer_EOI_Report.pdf` (no date)
- (c) Custom format you specify

**Default if not answered:** (a).

---

## DECISION 8: Cover page data range

**Question:** On the dashboard and PDF, when filters are applied, should the displayed date range match the filter or always show the full reporting window?

Example: if Paragon filters to "last 7 days," should the hero say "29 April - 4 May" or stay "9 April - 4 May"?

**Default if not answered:** Match the filter. The user filtered for a reason, the page should reflect what they're looking at.

---

## DECISION 9: Status filter combinations

**Question:** When the dashboard shows the status breakdown (Approved / Pending / Rejected) and the user has filtered to only "Approved" via the status chip, what should the status breakdown show?

- (a) Show only Approved (other cards hidden)
- (b) Show all three cards but Pending and Rejected display 0
- (c) Status filter doesn't affect the status breakdown section, only the daily charts and table

**Default if not answered:** (c). The status breakdown is by definition about all statuses; filtering it doesn't make semantic sense.

---

## DECISION 10: What happens when no data exists

**Question:** What does Paragon see if they log in before you've published anything?

- (a) Friendly empty state: "Your dashboard is being prepared. Sakneen will publish your first report shortly."
- (b) Locked screen with the same message
- (c) Show the structure with placeholder zeros (looks broken, recommend not)

**Default if not answered:** (a).

---

## DECISION 11: Audit log retention

**Question:** How long should we keep `audit_log` entries?

- (a) Forever (small table, no real cost)
- (b) 90 days, auto-prune older
- (c) 1 year, auto-prune older

**Default if not answered:** (a). Storage is cheap, audit data is useful.

---

## DECISION 12: PDF export — current view or full data?

**Question:** When Paragon clicks "Download PDF" while filters are applied, should the PDF reflect the filters or always be the full report?

- (a) Always the full report (matches the static reference, simpler)
- (b) The PDF reflects current filters (more useful but more complex)

**Default if not answered:** (a) for MVP. Add (b) as a v2 enhancement labeled "Download filtered view."

---

## DECISION 13: Repository visibility

**Question:** Should `sakneen-dashboards` be a private GitHub repo or public?

**Default if not answered:** Private. (Obviously, but worth confirming.)

---

## DECISION 14: Who owns the codebase day-to-day?

**Question:** After MVP ships, who maintains and extends this?

- (a) Hussein's engineering team (folds into main Sakneen platform team)
- (b) Standalone, maintained by Youssef + a contractor
- (c) Build it, then hand off to engineering after v1 stable

**Default if not answered:** (c). Ship MVP, get Paragon happy, then scope handoff.

**Why it matters:** Affects code style decisions. If folding into Sakneen platform, match their conventions (Ant Design etc.). If standalone, keep it lean.

---

## DECISION 15: What's the "v2 trigger"?

**Question:** What signal would tell you it's time to start building v2 (more clients, platform integration, AI features)?

- (a) Paragon successful + 1 more client signed
- (b) Specific revenue milestone (e.g. $100K ARR from dashboards)
- (c) Calendar trigger (e.g. "after Q3 2026")

**Default if not answered:** Don't worry about it for now. Ship MVP, see what Paragon and the next client actually ask for, decide based on real signals.

---

## How to use this document

For each decision:
1. Claude Code: when you reach the point where this decision matters, **stop and ask Youssef in the chat**.
2. If Youssef has already given an answer in conversation, note it here so it's recorded.
3. If Youssef says "use the default," update this doc to reflect the choice and proceed.

Don't silently pick a default. The defaults exist as fallbacks, not as auto-decisions.
