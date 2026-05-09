# CLAUDE.md

> This file is loaded automatically by Claude Code at the start of every session in this project. Keep it short. Detailed context lives in `docs/`.

## Project: Sakneen Client Dashboards

Multi-tenant web app for Sakneen (B2B PropTech SaaS in Egypt). MVP: a single live dashboard for Paragon Adeer showing daily EOI data. Built to scale to many clients.

## You are working with: Youssef Noureldin (COO, Sakneen)

- Communicates concisely, informally, in shorthand
- **No em dashes anywhere in user-facing copy.** Use commas, periods, parentheses.
- Wants you to ask clarifying questions before assuming
- Reviews implementation plans before non-trivial changes
- Prefers complete rewrites over partial patches when something's broken
- Direct, unsentimental copy. No clichés, no marketing fluff.

## Before doing anything, read these in order

1. `README.md` — orientation
2. `docs/01-product-spec.md` — what's in/out of scope
3. `docs/02-context-sakneen.md` — who Sakneen is, brand, voice
4. `docs/03-architecture.md` — stack and why
5. `docs/04-data-model.md` — schema and Excel parsing edge cases (CRITICAL)
6. `docs/05-design-system.md` — colors, fonts, components
7. `docs/06-pages-and-flows.md` — every page, every API route
8. `docs/07-build-plan.md` — day-by-day plan
9. `docs/08-deployment.md` — Railway + domain setup
10. `docs/09-open-decisions.md` — things to ask before assuming

The static PDF in `reference/` is the design source of truth. Match it pixel-for-pixel in print mode and structure-for-structure in interactive mode.

## Stack at a glance

- **Framework:** Next.js 15 App Router + TypeScript
- **Styling:** Tailwind CSS, no component library
- **Database:** Postgres + Drizzle ORM
- **Auth:** NextAuth (Auth.js v5), credentials provider
- **Charts (interactive):** Recharts
- **Charts (PDF/print):** server-rendered SVG
- **PDF generation:** Playwright headless Chromium
- **Validation:** Zod
- **Email:** Resend
- **Hosting:** Railway (single service + Postgres + volume)
- **Package manager:** pnpm

## Hard rules (non-negotiable)

1. **Multi-tenant from day one.** Every domain table has `client_id`. No hardcoded "paragon" except in seed scripts.
2. **No em dashes in user-facing strings.** Use ` - ` or `,` or `()` or `;`.
3. **The static PDF reference is the design contract.** Same fonts, same colors, same structure, same spacing rhythm.
4. **Ask Youssef on items in `docs/09-open-decisions.md`.** Don't pick defaults silently.
5. **Phase 1 is Excel upload only.** Don't start on Sakneen platform integration.
6. **All admin routes check `role === 'sakneen_admin'`.** All client routes derive `client_id` from session, never trust URLs.
7. **No Ant Design, no Redux, no MUI.** Keep the project lean and independent.

## Useful commands

```bash
pnpm dev                 # local dev server
pnpm build               # production build
pnpm db:generate         # generate Drizzle migration after schema change
pnpm db:migrate          # apply migrations
pnpm db:seed             # run seed script
pnpm db:studio           # open Drizzle Studio (DB UI)
pnpm typecheck           # tsc --noEmit
pnpm lint                # next lint
```

## Brand colors (must use these exact hexes)

```
Sakneen Blue:    #2109C4
Terracotta:      #C84B31
Spark Green:     #8AE688 (light) / #4FB54E (dark, used as Approved status)
Warm Cream:      #F5F0E8
Charcoal:        #1A1A1A
```

## Brand fonts

```
DM Serif Display — display, big numbers
DM Sans — UI, body
DM Mono — labels, eyebrows, dates, technical metadata
```

All available via `next/font/google`. See `docs/05-design-system.md`.

## Default behavior when stuck

1. Re-read the relevant doc in `docs/`
2. Check `docs/09-open-decisions.md` for whether this is something Youssef should decide
3. If yes, ASK in the chat
4. If no and the doc has the answer, follow it
5. If no and the doc is silent, propose 2-3 options and ask Youssef to pick

## Don't

- Don't silently install a UI library to "save time"
- Don't add features not in `docs/01-product-spec.md` MVP scope
- Don't optimize prematurely (no Redis, no microservices, no GraphQL)
- Don't refactor working code unless asked
- Don't write long preambles or summaries when responding; mirror Youssef's style and stay concise
