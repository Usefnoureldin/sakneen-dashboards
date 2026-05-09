# 05 — Design System

> **The static PDF is the source of truth for visual design.** Every choice below is extracted from it. When in doubt, open the PDF and match.

## Design tokens

```css
/* tailwind.config.ts — extend theme */

colors: {
  // Sakneen brand
  'sakneen-blue': '#2109C4',
  'sakneen-blue-dark': '#1A1A1A',  // used as headline color and dark backgrounds
  'terracotta': '#C84B31',
  'spark-green': '#8AE688',
  'spark-green-dark': '#4FB54E',
  'warm-cream': '#F5F0E8',
  'charcoal': '#1A1A1A',

  // Status accents
  'status-approved': '#4FB54E',
  'status-pending': '#F59E0B',
  'status-rejected': '#C84B31',

  // Status pill backgrounds
  'pill-approved-bg': '#E8F8E8',
  'pill-approved-fg': '#2E7B2E',
  'pill-pending-bg': '#FEF3C7',
  'pill-pending-fg': '#92400E',
  'pill-rejected-bg': '#FBE5DD',
  'pill-rejected-fg': '#8B2A1B',

  // Slate scale (UI grays)
  slate: {
    50:  '#F8F9FB',
    100: '#EEF1F6',
    200: '#DDE2EB',
    300: '#C5CCD9',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
  },
},

fontFamily: {
  serif: ['"DM Serif Display"', 'serif'],
  sans:  ['"DM Sans"', 'sans-serif'],
  mono:  ['"DM Mono"', 'monospace'],
},

borderRadius: {
  // Used in PDF: 12px (small cards), 14px (medium), 16px (chart blocks), 24px (rare large)
  'md': '12px',
  'lg': '14px',
  'xl': '16px',
  '2xl': '24px',
},
```

Load fonts in `app/layout.tsx`:
```tsx
import { DM_Serif_Display, DM_Sans, DM_Mono } from 'next/font/google';

const serif = DM_Serif_Display({ weight: '400', subsets: ['latin'], variable: '--font-serif' });
const sans = DM_Sans({ weight: ['400','500','600','700'], subsets: ['latin'], variable: '--font-sans' });
const mono = DM_Mono({ weight: ['400','500'], subsets: ['latin'], variable: '--font-mono' });
```

## Typography scale

| Use | Font | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|---|
| Cover hero title | DM Serif Display | 68px | 400 | -1px | 0.95 |
| Section H1 | DM Serif Display | 30px | 400 | -0.5px | 1.05 |
| Section H2 | DM Serif Display | 22px | 400 | -0.3px | 1.1 |
| Card title (chart, stat) | DM Serif Display | 16-22px | 400 | — | 1.1 |
| Big number (hero stat) | DM Serif Display | 42-56px | 400 | -1 to -1.5px | 1.0 |
| Eyebrow / section label | DM Mono | 9-10px | 400 | 2px | — |
| Pill / badge | DM Mono | 9-10px | 400 | 1.5px | — |
| Body | DM Sans | 12-14px | 400 | — | 1.4-1.5 |
| Small label | DM Mono | 8-10px | 400 | 1.5-2px | — |
| Stat value | DM Sans | 19-22px | 600 | — | 1.0 |
| Table header | DM Mono | 8-9px | 400 | 1.5px | — |
| Table body | DM Sans | 10-12px | 400 | — | — |

Eyebrow labels are ALL CAPS via `text-transform: uppercase`, and use the terracotta color when above headlines.

## Spacing rhythm

The PDF uses an 8px-ish grid but is loose about it. Common values:
- Card padding: `14-22px` (smaller cards = less padding)
- Card gap (in grid): `8-14px`
- Section margin (below): `16-22px`
- Section eyebrow → headline: `6-8px`
- Headline → subhead: `6px`
- Subhead → content: `16-22px`

Don't be religious about a strict 4/8 grid. Match the visual rhythm of the PDF.

## Component primitives to build

### `<HeroCard variant="primary" | "terracotta">`

Big colored card. Sakneen Blue or Terracotta. Used for hero KPIs.

```tsx
<HeroCard variant="primary">
  <Label>Total EOIs Collected</Label>     {/* mono, uppercase, 9px, white/75 */}
  <BigNumber>638</BigNumber>               {/* serif display, 42px */}
  <Unit>expressions of interest</Unit>     {/* sans, 12px, white/80 */}
  <Sub>Avg 28 per active day...</Sub>      {/* sans, 11px, with top border */}
</HeroCard>
```

### `<StatCard>`

Small slate-50 card with a label and value.

```tsx
<StatCard>
  <Label>Active Days</Label>      {/* mono, uppercase, 8px, slate-500 */}
  <Value>23</Value>                {/* sans, 19px, weight 600, charcoal */}
  <Sub>days with EOI activity</Sub>{/* sans, 10px, slate-600 */}
</StatCard>
```

Container: `bg-slate-50 border border-slate-200 rounded-md p-3`.

### `<StatusCard status="approved" | "pending" | "rejected">`

White card with a 4px colored top accent bar, a colored badge, and a big percentage.

```tsx
<StatusCard status="approved">
  <Badge>● Approved</Badge>           {/* pill bg/fg per status */}
  <Percentage>66.9%</Percentage>      {/* serif, 36px */}
  <MetaRow label="Count" value="427" />
  <MetaRow label="Value" value="21.35M EGP" />
</StatusCard>
```

### `<ChartBlock>`

White card wrapping a chart with title row + legend.

```tsx
<ChartBlock>
  <ChartHeader>
    <ChartTitle>Daily EOI Count</ChartTitle>           {/* serif, 16px */}
    <ChartSub>Total EOIs received per day</ChartSub>   {/* sans, 11px, slate-500 */}
    <Legend items={[...]} />
  </ChartHeader>
  <ChartCanvas>{/* chart */}</ChartCanvas>
</ChartBlock>
```

Container: `bg-white border border-slate-200 rounded-xl p-4 mb-3`.

### `<TypeCard variant="featured" | "default">`

Used on the type distribution page (Residential / Admin cards).

Featured = warm-cream background (Residential).
Default = white with slate border (Admin).

Has: name (serif 20px), pill badge (mono uppercase), big percentage (serif 48px), splits grid (count + value).

### `<EyebrowLabel>`

```tsx
<EyebrowLabel>Status Distribution</EyebrowLabel>
// rendered as: <p class="font-mono text-[9px] uppercase tracking-[2px] text-terracotta mb-1.5">
```

### `<PageHeader>`

Top of every content page (mirrors PDF header bar):

```tsx
<PageHeader>
  <Brand>sakneen | <span class="text-charcoal/60">Enterprise</span></Brand>
  <Crumbs>Paragon Adeer · Dashboard</Crumbs>
</PageHeader>
```

Bottom border separator, padding-bottom 10px, margin-bottom 18px.

## Charts (interactive version)

Use **Recharts** for the dashboard. It's the closest to "matplotlib in the browser" while also being accessible and themeable. Specifically:

- `<BarChart>` for daily count + daily value
- `<BarChart>` with `<Bar stackId="a">` for stacked-by-status views
- `<PieChart>` with inner radius for the status doughnut
- `<BarChart layout="vertical">` for the type composition horizontal bars

Apply Sakneen styling globally:

```tsx
// recharts theme overrides
const chartTheme = {
  fontFamily: 'var(--font-sans)',
  fontSize: 10,
  axisColor: '#374151',
  gridColor: '#DDE2EB',
  barRadius: 4,
};
```

For tooltips, build a custom `<Tooltip>` component in Sakneen voice:
- White bg, slate-200 border, rounded-md, padding 8-10px
- Date in mono uppercase 9px slate-500
- Value in sans 13px charcoal weight 600
- Status/type label in sans 11px slate-700

For the print/PDF version, regenerate charts as static SVGs server-side (the existing matplotlib approach in `reference/generate_charts.py`).

## Print mode

The `/print/:client_id` route is a server-rendered page that mirrors the PDF EXACTLY — it's the same HTML/CSS structure as the static PDF I built. Playwright loads this page and prints to PDF.

Key differences from interactive dashboard:
- No interactivity (no filters, no toggles)
- Charts are server-rendered SVGs, not Recharts
- Multi-page layout with page-break-after on each section
- Footer with page numbers
- Cover page with the Sakneen Blue full-bleed background

The print stylesheet is mostly the CSS from the static PDF, ported to a Tailwind-compatible structure.

## Responsive rules

The interactive dashboard needs to work on:
- **Desktop (1280px+):** primary target, all charts at full width
- **Tablet (768-1279px):** cards reflow to 2 columns, charts shrink
- **Mobile (≤767px):** single column, charts simplified (consider hiding the daily-by-status stacked chart on mobile, show a simpler version)

The admin upload UI is desktop-only. Don't bother with mobile for it.

The print/PDF version is fixed A4, no responsiveness.

## Empty states / loading states / errors

These are missing from the static PDF and need explicit design. Keep them on-brand:

**Empty state (no data uploaded yet):**
- Centered card, warm-cream background
- Headline (serif 22px): "No data published yet"
- Subhead (sans 13px): "Sakneen hasn't published a report for you yet. You'll see today's numbers here once it's live."
- No CTA, just the message

**Loading state:**
- Skeleton screens matching the layout (gray pulses where content will appear)
- Avoid spinners; skeletons feel more "real product"

**Error state:**
- Inline error banner: terracotta-tinted background, terracotta border, mono uppercase 9px label "ERROR", sans 13px message
- For full-page errors: simple page with serif headline "Something went wrong" and a "Try again" link

## Accessibility minimums

- Color contrast: all text-on-color meets WCAG AA at minimum
- All interactive elements have visible focus states (use `ring-2 ring-sakneen-blue/40` pattern)
- All buttons and links have descriptive text or aria-labels
- Form inputs have labels (visible or sr-only)
- Charts have a fallback table view (the daily ledger on page 6 of the PDF is exactly this)
- Respect `prefers-reduced-motion`: disable chart animations when set

## What NOT to add

- Dark mode (not in MVP, can add via CSS vars later)
- Animations beyond Recharts defaults (no fade-ins, no stagger)
- Toast notifications (use inline messages instead)
- Modals for destructive actions on MVP (use confirm dialogs minimally; for upload publish, use a full preview page instead of a modal)
- Custom scrollbars
- Hero illustrations or decorative graphics
