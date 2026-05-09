# 09 — Open Decisions

> These are things Youssef needs to decide before or during the build. ASK before assuming. They're listed roughly in the order they'll come up.

## DECISION 1: Domain structure

**Question:** Do you want one of these patterns?

- (a) `paragon.sakneen.com` — per-client subdomain (recommended)
- (b) `dashboards.sakneen.com/paragon` — single app domain with paths
- (c) Something else (e.g. `app.sakneen.com`)?

**Default if not answered:** Go with (a) `paragon.sakneen.com`. Most premium feel, easiest to whitelabel later.

**Why it matters:** Affects DNS config, NextAuth callback URLs, and routing logic. Easy to change before launch, harder after.

---

## DECISION 2: Excel format standardization

**Question:** Will you ask whoever exports the EOI Excel from Sakneen's platform to standardize the format? Specifically:

- Dates as text in `DD-MM-YYYY` (no Excel date type)
- No blank rows
- Always exact same columns in same order

**Default if not answered:** Build the parser to handle the messy current format (the date-swap workaround). Adds ~half a day of work and tech debt that has to live in the parser forever.

**Why it matters:** Cleaner export = simpler parser, fewer edge cases, lower chance of silent data corruption. If Hussein's team can spend 30 min fixing the export, it's worth it.

---

## DECISION 3: Paragon users

**Question:** Who at Paragon should have access? Need names and emails. Recommend 2-3 people to start.

**Default if not answered:** Just Fouad Harraz (`fouad@paragonadeer.com` or wherever). Add more later via admin UI.

**Why it matters:** I need real users to seed the production DB before showing them the dashboard.

---

## DECISION 4: Initial password handling for new users

**Question:** When you invite a new client user, what should happen?

- (a) System generates a temp password, emails it to them, they change on first login
- (b) System sends a "set your password" magic link, they pick their own
- (c) You set a password manually and tell them in person/WhatsApp

**Default if not answered:** Go with (b) — most professional, works without trusting email-with-passwords.

**Why it matters:** Affects the user invite flow. (b) requires building a password-set page; (a) is simpler but less secure; (c) means we don't email at all.

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
