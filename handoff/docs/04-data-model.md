# 04 — Data Model

## Postgres schema

```sql
-- ────────────────────────────────────────────────────────────
-- clients: tenants (Paragon Adeer is the only seeded one for MVP)
-- ────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,            -- e.g. 'paragon-adeer', used in URLs/subdomains
  name TEXT NOT NULL,                   -- 'Paragon Adeer'
  display_name TEXT NOT NULL,           -- 'Paragon Adeer' or whatever they want shown
  logo_url TEXT,                        -- optional, for v2 whitelabel
  accent_color TEXT,                    -- optional, for v2 whitelabel; default sakneen blue
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- users: humans who log in. Belong to either Sakneen (admin) or one client.
-- ────────────────────────────────────────────────────────────
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,          -- bcrypt
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sakneen_admin', 'client_user')),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,  -- NULL for sakneen_admin
  active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_user_must_have_client CHECK (
    (role = 'sakneen_admin' AND client_id IS NULL) OR
    (role = 'client_user' AND client_id IS NOT NULL)
  )
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_client ON users (client_id) WHERE client_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- eoi_uploads: each Excel file that gets uploaded
-- ────────────────────────────────────────────────────────────
CREATE TABLE eoi_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'superseded', 'discarded')),
  file_path TEXT NOT NULL,              -- e.g. '/data/uploads/{client_id}/{upload_id}.xlsx'
  file_name TEXT NOT NULL,              -- original filename
  file_size_bytes INTEGER NOT NULL,
  row_count INTEGER NOT NULL,
  date_min DATE NOT NULL,
  date_max DATE NOT NULL,
  total_count INTEGER NOT NULL,
  total_value_egp BIGINT NOT NULL,      -- in EGP, no decimals (50,000 EGP = 50000)
  parse_warnings JSONB,                 -- e.g. ["3 rows skipped (blank)", "12 dates normalized from datetime"]
  notes TEXT,                           -- optional Youssef-supplied notes
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_eoi_uploads_client_status ON eoi_uploads (client_id, status);
CREATE INDEX idx_eoi_uploads_published ON eoi_uploads (client_id, published_at DESC) WHERE status = 'published';

-- Only one published upload per client at a time
CREATE UNIQUE INDEX idx_eoi_uploads_one_published_per_client
  ON eoi_uploads (client_id) WHERE status = 'published';

-- ────────────────────────────────────────────────────────────
-- eoi_records: one row per EOI in the uploaded Excel
-- ────────────────────────────────────────────────────────────
CREATE TABLE eoi_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES eoi_uploads(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('Residential', 'Admin')),
  status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
  eoi_date DATE NOT NULL,
  amount_egp BIGINT NOT NULL,           -- 50000 for the standard EOI
  source_row_index INTEGER NOT NULL,    -- which row in the original Excel (for debugging)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eoi_records_client_date ON eoi_records (client_id, eoi_date) WHERE upload_id IN (SELECT id FROM eoi_uploads WHERE status = 'published');
CREATE INDEX idx_eoi_records_upload ON eoi_records (upload_id);

-- ────────────────────────────────────────────────────────────
-- audit_log: who did what, when. Keep it simple.
-- ────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  client_id UUID REFERENCES clients(id),
  action TEXT NOT NULL,                 -- 'login', 'upload_create', 'upload_publish', 'pdf_download', etc.
  metadata JSONB,                       -- action-specific context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_client_created ON audit_log (client_id, created_at DESC);
CREATE INDEX idx_audit_log_user_created ON audit_log (user_id, created_at DESC);
```

## Excel parsing rules (CRITICAL — read this carefully)

The Excel files Sakneen exports today are messy. Here's what I learned parsing the first one:

### Source file shape

Sheet name: `Export EOI Requests (N)` where N varies. Single sheet per file. Columns:

| Index | Header | Type | Notes |
|---|---|---|---|
| 0 | `Count of EOI` | Number | Always `1` per row in observed data |
| 1 | `Unit Type` | String | `Residential` or `Admin` |
| 2 | `Status` | String | `approved`, `pending`, `rejected` (lowercase) |
| 3 | `Timestamp` | Date OR String | THE NIGHTMARE COLUMN, see below |
| 4 | `Amount of EOI` | Number | Always `50000` in observed data |
| 5 | (no header) | — | Empty / unused, ignore |

### The date column problem

The source format is **DD-MM-YYYY** (Egyptian convention). But Excel parses some entries as datetimes when both DD and MM are <= 12, and leaves others as strings. So you get a mix:

- `'30-04-2026'` (string) — clearly DD-MM-YYYY, parses to 30 April 2026
- `datetime(2026, 4, 5)` (datetime) — Excel parsed `05-04-2026` as month=4, day=5. The original was DD-MM, so it should be **5 April 2026**, not 4 May.

**Parsing logic:**

```typescript
function parseExcelDate(value: Date | string): Date {
  if (typeof value === 'string') {
    // Format: DD-MM-YYYY
    const [dd, mm, yyyy] = value.split('-').map(Number);
    return new Date(yyyy, mm - 1, dd);
  }
  if (value instanceof Date) {
    // Excel mis-parsed DD-MM as MM-DD. Swap day and month.
    // Original "05-04-2026" → Excel parsed as month=4, day=5 → real date is day=5, month=4 → 5 April 2026
    // Need to reconstruct: real_date = (year, excel_day, excel_month)... wait no.
    //
    // Re-check: if string is "05-04-2026" (= 5 April 2026 in DD-MM-YYYY)
    // and Excel reads it as a date, Excel might interpret as either:
    //   (a) DD-MM-YYYY → datetime(2026, 4, 5) ← if Excel locale matches
    //   (b) MM-DD-YYYY → datetime(2026, 5, 4) ← US locale
    //
    // What I observed empirically:
    // - Strings remain as strings when DD > 12 (e.g. "30-04-2026")
    // - Dates that parsed have month component <= 12 (Jan-Dec)
    // - The parsed datetimes had day,month values consistent with the data being DD-MM
    //   i.e. datetime(2026,4,5) = day=5, month=4 = "05 of month 4" 
    //
    // Verdict: the parsed datetimes had their day and month SWAPPED relative to source.
    // To recover original: real day = excel month, real month = excel day
    return new Date(value.getFullYear(), value.getDate() - 1, value.getMonth() + 1);
  }
  throw new Error(`Cannot parse date: ${value}`);
}
```

**Verify this assumption every time you ship a parser change.** Run it against the reference file and confirm dates land in a contiguous Apr-May 2026 range. If they look scattered across the year, the swap logic is wrong.

### Validation rules on parse

- Reject upload if any column header is missing
- Skip rows where `Count of EOI` is null/empty (these are blank rows)
- Reject upload if any non-blank row has invalid `Status` (must be one of approved/pending/rejected, case-insensitive)
- Reject upload if any non-blank row has invalid `Unit Type` (must be Residential or Admin)
- Warn (don't reject) if `Count of EOI != 1` for any row — store as-is, but flag in `parse_warnings`
- Warn if `Amount of EOI != 50000` for any row — store as-is
- Warn if date range exceeds 90 days (might indicate bad data)
- Reject if more than 5% of rows fail to parse

### Normalization

- Status: lowercase
- Unit Type: title case (`Residential`, `Admin`)
- Amount: integer EGP (no decimals)
- Date: stored as DATE in Postgres (no time component)

### Idempotency

Each upload creates a new `eoi_uploads` row. Publishing one supersedes the prior published one (transitions prior to `superseded` in same transaction).

If Youssef re-uploads the same data twice, that's fine — second upload just becomes the new draft and he can publish or discard. We don't dedup automatically; he sees row counts in preview and can decide.

## Business rules / derivations

These are computed from `eoi_records` and surfaced in the dashboard:

```typescript
// Top KPIs
total_count = COUNT(*)
total_value_egp = SUM(amount_egp)
unique_dates = COUNT(DISTINCT eoi_date)
avg_per_active_day = total_count / unique_dates  // round to integer
avg_value_per_active_day = total_value_egp / unique_dates
peak_day = (date, count) where count is max
peak_value_day = (date, value) where value is max

// Status breakdown
approved_count = COUNT WHERE status = 'approved'
pending_count = COUNT WHERE status = 'pending'
rejected_count = COUNT WHERE status = 'rejected'
approved_pct = approved_count / total_count * 100  // round to 1 decimal
... same for pending/rejected
approved_value = SUM(amount_egp) WHERE status = 'approved'
... same for pending/rejected

// Type distribution
residential_count = COUNT WHERE unit_type = 'Residential'
admin_count = COUNT WHERE unit_type = 'Admin'
residential_value = SUM(amount_egp) WHERE unit_type = 'Residential'
admin_value = SUM(amount_egp) WHERE unit_type = 'Admin'
res_pct = residential_count / total_count * 100
adm_pct = admin_count / total_count * 100

// Daily series (for charts)
daily = GROUP BY eoi_date {
  count: COUNT(*)
  value: SUM(amount_egp)
  approved_count: COUNT WHERE status = 'approved'
  pending_count: COUNT WHERE status = 'pending'
  rejected_count: COUNT WHERE status = 'rejected'
  approved_value: SUM WHERE status = 'approved'
  pending_value: SUM WHERE status = 'pending'
  rejected_value: SUM WHERE status = 'rejected'
}
```

All of these should be computed server-side and shipped to the client as a single payload. Don't make the browser do aggregation over thousands of rows.

## Number formatting

- Counts: `1,234` (thousands separator)
- Values short form: `1.39M`, `500K`, `21.35M EGP`
- Values long form: `21,350,000 EGP` or `21,350,000`
- Percentages: 1 decimal place, `66.9%`
- Dates short: `09 Apr`
- Dates long: `09 April 2026`
- Date range: `09 April 2026 — 04 May 2026` (use em dash here ONLY in the date range label, since it's a typographic convention and not Youssef's prose)
  - **Actually** — Youssef said no em dashes. Use a regular hyphen with spaces: `09 April 2026 - 04 May 2026`

## What gets seeded on first deploy

```sql
INSERT INTO clients (slug, name, display_name)
VALUES ('paragon-adeer', 'Paragon Adeer', 'Paragon Adeer');

INSERT INTO users (email, password_hash, name, role, client_id)
VALUES (
  'youssef@sakneen.com',
  '<bcrypt hash of temp password>',
  'Youssef Noureldin',
  'sakneen_admin',
  NULL
);

-- Paragon users will be added by Youssef via admin UI before launch
```

## Migration strategy

Use `drizzle-orm` or `prisma` for type-safe migrations. Either is fine. Pick one and stick. Don't hand-write SQL migrations after MVP.

Naming convention: `{timestamp}_{description}.sql` like `20260505_initial_schema.sql`.
