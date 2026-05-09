# 01 — Product Spec

## The product in plain language

Sakneen's clients today get static PDF reports for things like daily EOI tracking. We're turning those into live, interactive dashboards that the client logs into. Sakneen uploads the daily Excel, the client sees the data update.

MVP is exactly one of these dashboards: Paragon Adeer's daily EOI tracker.

## Why this exists

Three reasons, in order of importance:

1. **Retention.** Once a client checks a live dashboard every morning with their coffee, switching costs go up. Static PDFs don't create that habit.
2. **Differentiation.** "We give you a live dashboard your team can log into" is a stronger sales pitch than "we email you reports."
3. **Foundation for AI features.** The same surface that shows numbers today becomes the surface that shows AI-generated insights, weekly briefings, and demand intelligence later. Build the surface first, plug AI in second.

## Scope

### In scope (MVP, 1-2 weeks)

- One client: Paragon Adeer
- One report: daily EOI tracker (matches the static PDF that already exists)
- Sakneen admin upload flow: drag Excel, validate, publish
- Client-facing dashboard with the same visual structure as the PDF
- Interactive charts (hover, tooltips, filters)
- Date range filter (last 7 days / last 30 days / full window / custom)
- Count vs. Value toggle
- Status filter (approved / pending / rejected / all)
- Type filter (residential / admin / all)
- Auto-refresh every 5 minutes
- "Download PDF" button that regenerates the original PDF
- Email + password auth for both sides
- 2-3 Paragon users, 2-3 Sakneen admins
- Multi-tenant data model (client_id everywhere) but only Paragon seeded
- Hosted on Railway with a custom domain
- Mobile responsive (the dashboard, not the admin)

### Out of scope for MVP, planned for v2

- More clients (SODIC, Tatweer, Marakez, etc.) — schema supports them, just not seeded
- Direct integration with Sakneen platform (replaces Excel upload)
- AI-generated insights and commentary
- Custom whitelabel theming per client (logo, accent color)
- Real-time push updates (websockets / Server-Sent Events) instead of polling
- Multi-report dashboards (sales velocity, broker performance, etc.)
- Slack / WhatsApp notifications when a new upload publishes
- Comments / annotations on the dashboard
- User-level role permissions (everyone in a client's org sees the same thing for now)

### Explicitly not building, ever

- A general-purpose BI tool. This is purpose-built for real estate developer reporting.
- Direct Excel editing in-app. Upload only, no inline edits.
- Multi-language. English only for now (Arabic later as a v2+ item if Paragon asks).

## Success criteria for MVP

The MVP is done when:

1. Youssef can complete the daily upload flow in under 30 seconds
2. Paragon can log in and see today's numbers within 5 seconds of Youssef hitting publish
3. The PDF download produces a file visually identical to the static PDF (same fonts, colors, layout)
4. Adding the second client (SODIC, when it happens) takes under 30 minutes of work, no code changes
5. Youssef successfully demos it to Fouad at Paragon without anything breaking

## What we're NOT optimizing for

- **Speed of upload to thousands of rows.** The Excel files we've seen are 600-1000 rows. If it ever needs to handle 100k rows, that's a v2 problem.
- **Sub-second latency.** A 2-3 second page load is fine. This is not a trading dashboard.
- **Pixel-perfect cross-browser support.** Chrome and Safari on desktop and iOS Safari are the targets. Firefox and Edge should work, IE doesn't matter.
- **Offline support.** Always assumes internet.

## Future-state vision (informs MVP decisions)

This dashboard is the first instance of a product line. Within 6-12 months, we want:

- 5-10 clients each with their own dashboard URL
- Multiple report types per client (EOIs, sales velocity, broker performance, AI insights)
- Direct platform integration so Sakneen's database feeds the dashboards live, no manual upload
- AI weekly briefings auto-generated and surfaced as a section
- A self-serve flow where new clients can be provisioned by Sakneen admin in 5 minutes

MVP architecture decisions should not foreclose any of this. Specifically:
- Schema must support multiple clients (✓)
- Schema must support multiple report types per client (use `report_type` enum)
- Code must support pluggable data sources (the Excel parser is one source; platform integration is another)
- UI must support whitelabel theming hooks even if not used in MVP (CSS variables, not hardcoded colors)
