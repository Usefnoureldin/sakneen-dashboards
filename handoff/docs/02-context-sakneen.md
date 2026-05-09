# 02 — Context: Sakneen, Youssef, Paragon

## Sakneen, in one paragraph

Sakneen is a B2B PropTech SaaS for real estate developers in Egypt and the Middle East. It replaces the Excel + WhatsApp + Salesforce + manual PDF mess that developers use to manage inventory, sell units, and run their sales teams. Three products: a Digital Sales Tool (interactive map + one-click offer generation), a Performance Management Tool (sales analytics with AI), and an EOI / Launch Digitization tool. Standard pricing is EGP 1,500,000 per project per year, billed quarterly, unlimited users, 3-week implementation. Big clients include SODIC, Tatweer Misr, Marakez, Imkan, Al Karma, Lasirena, Park St., Arkan Palm.

## Sakneen brand

- **Logo:** "sakneen" in DM Sans 700, lowercase, with a small house-shape "n" in the middle
- **Tagline:** "How houses become homes"
- **Positioning:** "The Operating System for Shaping Space"
- **Voice:** direct, confident, unsentimental, no marketing fluff
- **Colors:**
  - Sakneen Blue: `#2109C4` (primary, used for cover, hero stats, residential indicator)
  - Terracotta: `#C84B31` (accent, used for value/EGP, admin/commercial indicator, eyebrow labels)
  - Spark Green: `#8AE688` and dark variant `#4FB54E` (positive states, approved status)
  - Warm Cream: `#F5F0E8` (subtle background, featured cards)
  - Charcoal: `#1A1A1A` (body text, dark backgrounds)
- **Fonts:**
  - DM Serif Display — display headlines, big numbers
  - DM Sans — UI text, body, weights 400/500/600/700
  - DM Mono — labels, eyebrows, dates, technical metadata

## The leadership team

- **Ramy Khorshed** — CEO, Duke Econ + CS, started/exited a real estate portfolio. Currently in Johor Bahru, Malaysia. Builds product MVPs personally.
- **Hussein El Kheshen** — CTO, U Chicago Econ + CS, admitted HBS, ex-Tesla. Based in Egypt.
- **Youssef Noureldin** — COO. AUC architecture + real estate, ex Palm Hills asset management, ex Compass Capital (RE PE). Based in Egypt. **This is who you're working with.**

## Youssef (your user)

- Title: COO, Sakneen
- Owns: sales, pipeline, client acquisition, market expansion
- Email: youssef@sakneen.com (Sakneen) — Gmail is connected via youssef@suitespotegypt.com
- Communication: concise, informal, abbreviates, prefers shorthand
- Workflow preferences:
  - **No em dashes anywhere in outputs.** Use commas, periods, parentheses.
  - Direct, clear, unsentimental copy
  - Reviews implementation plans before approving non-trivial changes
  - Prefers complete rewrites over partial patches when something is broken
  - Asks Claude to ask clarifying questions before assuming
  - Catches edge cases, expects structured approval prompts
  - Uses Lovable-style structured prompts with explicit "DO NOT CHANGE" sections

## Paragon Adeer (the client this is for)

- Real estate developer, recently signed deal with Sakneen at EGP 2,500,000 + VAT (best and final)
- Primary contact: **Fouad Harraz**
- Active integration in progress: Salesforce EOI integration (their existing CRM connecting to Sakneen's EOI flow)
- The deal includes 1 free digital launch, hence the high focus on EOI tracking quality
- Contract structure was unusual: 70% Paragon Adeer / 30% Paragon split with 5-installment payment (flagged internally as "exception" to standard 4 quarterly cheques)
- This dashboard is essentially their daily operational tool during launch periods

## What Paragon will use this for

Daily EOI tracking during launches and unit allocations. They need to see, every morning:

1. How many EOIs came in yesterday
2. How much value those EOIs represent
3. What's been approved vs. pending vs. rejected
4. The split between Residential and Admin (commercial) units
5. Trend over the launch window

Today this is delivered as a static PDF that Youssef builds manually. Goal: eliminate the manual step, give Paragon a live URL.

## Paragon's tech-savviness assumption

Assume the people logging in are senior commercial real estate operators, not technical. Don't show them the Excel format details, don't surface error states with stack traces, don't expose anything that looks like an admin panel. Their experience should feel like a product, not a tool.

## What Sakneen sells, that's relevant context

The dashboard you're building is closest in spirit to the **Performance Management Tool with AI Analytics** that Sakneen already sells. Visually align with that product's positioning: real-time, data-rich, decision-grade reporting. The static PDF is the design template; the live dashboard is its successor.

## Current Sakneen tech stack (for reference, not constraint)

The main Sakneen platform runs Next.js 15, React 19, Ant Design, Tailwind, Redux Toolkit, Auth0, Mapbox GL, Three.js, PostHog, Supabase Postgres 17, Linear, Segment.

For this dashboard project, **don't pull in Ant Design or Redux**. They're heavy and unnecessary. Stick to vanilla Next.js + Tailwind + a small set of focused libraries (see `03-architecture.md`). The dashboard project should be lean and easy to maintain independently of the main platform.
