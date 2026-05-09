# Reference materials

These are source-of-truth artifacts. Use them, don't modify them.

## `Paragon_Adeer_EOI_Report_DESIGN_REFERENCE.pdf`

The static PDF report I generated. **This is the design contract for the dashboard.**

- The interactive dashboard (`/dashboard`) should match this in visual structure, fonts, colors, spacing rhythm, but adds interactivity (hover tooltips, filters, toggles, real-time updates)
- The print version (`/print` route, used to generate PDF downloads) should match this 1:1 — pixel-for-pixel where possible

When in doubt about a design decision, open this PDF and match it.

## `Sakneen_Company_Profile_2026.pdf`

Sakneen's company profile deck (used for client proposals). Reference for:
- Brand voice and tone (look at how product features are described)
- Visual language (page layouts, type hierarchy)
- Sakneen's three core products: Sales Tool, Performance Management Tool, EOI System

## `sample_eoi_export.xlsx`

A real Excel export from Sakneen's platform. The dashboard parser must handle this exact format. Use it as the test fixture for the parser.

Expected output when parsed:
- 638 valid rows (640 total, 2 blank)
- Date range: 9 April 2026 to 4 May 2026
- 23 unique active days
- Status mix: 427 approved, 169 pending, 42 rejected
- Type mix: 490 Residential, 148 Admin
- Total value: 31,900,000 EGP (every row is exactly 50,000 EGP)
- Peak day: 30 April with 84 EOIs

The file has the inconsistent date-column problem documented in `docs/04-data-model.md`. Specifically:
- 376 rows have dates as string `DD-MM-YYYY` (e.g. `"30-04-2026"`)
- 262 rows have dates as Excel datetimes that need their day/month swapped

If your parser produces output that doesn't match the numbers above, the date parsing logic is wrong. Re-read `docs/04-data-model.md`.

## When to update these

- `Paragon_Adeer_EOI_Report_DESIGN_REFERENCE.pdf` — only update if the visual design intentionally changes (talk to Youssef first)
- `Sakneen_Company_Profile_2026.pdf` — leave as-is; Sakneen's design team owns this
- `sample_eoi_export.xlsx` — leave as-is; if the export format ever changes, save the new version with a new filename and update parser tests
