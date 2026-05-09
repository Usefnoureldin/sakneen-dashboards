# Sakneen Client Dashboards — Project Handoff

> **You are Claude Code working on this project.** Read this entire file first. Then read the docs in the order listed below before writing any code.

---

## What this is

An interactive, client-facing dashboard product for Sakneen. MVP scope: a single dashboard for **Paragon Adeer** showing daily EOI (Expression of Interest) data. Built multi-tenant from day one so additional clients can be added with config changes, not rewrites.

Sakneen is a B2B PropTech SaaS for real estate developers in Egypt and the Middle East. This dashboard becomes the live, branded reporting layer that today is delivered as static PDFs.

## What you're building (in one paragraph)

A Next.js + Postgres app deployed on Railway. Sakneen team logs into `/admin`, uploads a daily Excel export, and the dashboard at `paragon.sakneen.com` (or similar) updates live. Client logs in via email + password, sees an interactive version of the static PDF report I previously built — same fonts, same colors, same structure, but with hover tooltips, date filters, and a "Download PDF" button that regenerates the original report on demand.

## Read these in order

1. **`docs/01-product-spec.md`** — what's being built, scope boundaries, MVP vs. v2
2. **`docs/02-context-sakneen.md`** — who Sakneen is, brand, voice, who Youssef is, who Paragon is
3. **`docs/03-architecture.md`** — stack, hosting, data flow, why Railway over Vercel
4. **`docs/04-data-model.md`** — Postgres schema, the Excel parsing edge cases, business rules
5. **`docs/05-design-system.md`** — colors, fonts, spacing, component patterns ported from the PDF
6. **`docs/06-pages-and-flows.md`** — every screen, every interaction, every API route
7. **`docs/07-build-plan.md`** — week-by-week roadmap, definition of done
8. **`docs/08-deployment.md`** — Railway setup, env vars, domain config, secrets
9. **`docs/09-open-decisions.md`** — things Youssef still needs to decide; ASK before assuming
10. **`reference/`** — the static PDF, Sakneen company profile, sample Excel, all source-of-truth artifacts

## Hard rules

- **No em dashes anywhere in user-facing copy.** This is a Youssef preference. Use commas, periods, or parentheses instead.
- **Direct, unsentimental copy.** No clichés, no marketing fluff. The reference PDF and Sakneen company profile are the voice template.
- **Multi-tenant from day one.** Even though only Paragon uses MVP, every table that holds data has a `client_id`. No hardcoded "paragon" anywhere except seeding.
- **Match the PDF exactly.** The static report I generated is the design contract. Same fonts (DM Serif Display, DM Sans, DM Mono), same Sakneen Blue (#2109C4), same Terracotta (#C84B31), same spacing rhythm, same component shapes. The interactive version adds behavior, it does not redesign.
- **Ask before assuming on the Open Decisions list.** Don't guess on the items in `docs/09-open-decisions.md`. Pause and ask Youssef.
- **Phase 1 is Excel upload only.** Do not start on Sakneen platform integration. That's phase 2 and the platform team owns it.

## Soft rules / Youssef's working style

- He likes complete rewrites over partial patches when something is wrong
- He reviews implementation plans before they're approved, so produce a plan first for any non-trivial change
- He prefers Claude ask clarifying questions before proceeding, rather than assuming
- He communicates in shorthand and abbreviations, return the favor
- He uses Lovable-style structured prompts with explicit "DO NOT CHANGE" sections — respect those when given

## How you'll know you're done with MVP

- Youssef can log in at `/admin`, drag in today's Excel, click Publish, log out
- Paragon's people can log in at `paragon.sakneen.com`, see today's data, hover charts, change date ranges, download a PDF
- Both flows are stable enough that Youssef can demo it to Fouad at Paragon without anything breaking
- Adding a second client (e.g. SODIC) is a 30-minute job: insert a row in `clients`, create a user, done

## Questions, blockers, anything ambiguous

Default behavior: ask Youssef directly in the Claude Code session before guessing.
