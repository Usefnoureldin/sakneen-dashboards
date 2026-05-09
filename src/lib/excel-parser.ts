import * as XLSX from "xlsx";
import { z } from "zod";

/**
 * Strict EOI Excel parser. Per handoff/docs/09-open-decisions.md decision #2,
 * we only accept the standardized export format:
 *
 *   - Sheet whose name starts with "Export EOI Requests"
 *   - Header row exactly: Count of EOI, Unit Type, Status, Timestamp, Amount of EOI
 *   - Timestamp cells are text DD-MM-YYYY only (not Excel datetime)
 *   - No blank rows
 *   - Fixed column order
 *
 * Bad input is rejected with a helpful message rather than silently coerced.
 * For the legacy mixed-format export, run scripts/convert-legacy-xlsx.ts first.
 */

export const EXPECTED_HEADERS = [
  "Count of EOI",
  "Unit Type",
  "Status",
  "Timestamp",
  "Amount of EOI",
] as const;

export const UNIT_TYPES = ["Residential", "Admin"] as const;
export const STATUSES = ["approved", "pending", "rejected"] as const;

export type UnitType = (typeof UNIT_TYPES)[number];
export type EoiStatus = (typeof STATUSES)[number];

export type ParsedRecord = {
  /** zero-based row index in the source sheet (excluding header) */
  sourceRowIndex: number;
  count: number;
  unitType: UnitType;
  status: EoiStatus;
  /** YYYY-MM-DD, no time component */
  eoiDate: string;
  amountEgp: number;
};

export type ParseSummary = {
  rowCount: number;
  dateMin: string;
  dateMax: string;
  totalCount: number;
  totalValueEgp: bigint;
  statusCounts: Record<EoiStatus, number>;
  typeCounts: Record<UnitType, number>;
  warnings: string[];
};

export type ParseResult = {
  records: ParsedRecord[];
  summary: ParseSummary;
};

export class ExcelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExcelParseError";
  }
}

const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;

function parseStandardDate(s: string, rowLabel: string): string {
  const m = s.match(dateRegex);
  if (!m) {
    throw new ExcelParseError(
      `${rowLabel}: timestamp must be text in DD-MM-YYYY (got ${JSON.stringify(s)}). ` +
        `If this is a legacy export with Excel-typed dates, convert it first.`,
    );
  }
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12) {
    throw new ExcelParseError(`${rowLabel}: invalid month ${mm} in date ${s}`);
  }
  if (day < 1 || day > 31) {
    throw new ExcelParseError(`${rowLabel}: invalid day ${dd} in date ${s}`);
  }
  // Round-trip validate: e.g. 31-02-2026 should fail.
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new ExcelParseError(`${rowLabel}: date ${s} does not exist on the calendar`);
  }
  return `${yyyy}-${mm}-${dd}`;
}

const RowSchema = z.object({
  count: z.number().int().min(0),
  unitType: z.enum(UNIT_TYPES),
  status: z.enum(STATUSES),
  amountEgp: z.number().int().min(0),
});

export function parseEoiWorkbook(buffer: Buffer | ArrayBuffer | Uint8Array): ParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { cellDates: false });
  } catch (e) {
    throw new ExcelParseError(`could not read xlsx: ${(e as Error).message}`);
  }

  const sheetName = wb.SheetNames.find((n) => n.startsWith("Export EOI Requests"));
  if (!sheetName) {
    throw new ExcelParseError(
      `no sheet named "Export EOI Requests" found. sheets: ${wb.SheetNames.join(", ")}`,
    );
  }
  const sheet = wb.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  if (rows.length === 0) {
    throw new ExcelParseError("sheet is empty");
  }
  const header = rows[0];
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (header[i] !== EXPECTED_HEADERS[i]) {
      throw new ExcelParseError(
        `header[${i}] expected "${EXPECTED_HEADERS[i]}", got ${JSON.stringify(header[i])}`,
      );
    }
  }

  const records: ParsedRecord[] = [];
  const warnings: string[] = [];
  const statusCounts: Record<EoiStatus, number> = { approved: 0, pending: 0, rejected: 0 };
  const typeCounts: Record<UnitType, number> = { Residential: 0, Admin: 0 };
  let totalValueEgp = 0n;

  let countWarnedNonOne = 0;
  let amountWarnedOff = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowLabel = `row ${r}`;
    const allBlank = row.every((c) => c === null || c === undefined || c === "");
    if (allBlank) {
      throw new ExcelParseError(
        `${rowLabel}: blank row found. Standardized exports must have no blank rows. ` +
          `Re-export or convert via scripts/convert-legacy-xlsx.ts.`,
      );
    }

    const raw = {
      count: typeof row[0] === "number" ? row[0] : Number(row[0]),
      unitType: typeof row[1] === "string" ? row[1] : String(row[1] ?? ""),
      status: typeof row[2] === "string" ? row[2].toLowerCase() : String(row[2] ?? "").toLowerCase(),
      timestamp: typeof row[3] === "string" ? row[3] : String(row[3] ?? ""),
      amountEgp: typeof row[4] === "number" ? row[4] : Number(row[4]),
    };

    if (typeof row[3] !== "string") {
      throw new ExcelParseError(
        `${rowLabel}: timestamp must be a text cell (got cell type ${typeof row[3]}, value ${JSON.stringify(row[3])}).`,
      );
    }

    const eoiDate = parseStandardDate(raw.timestamp, rowLabel);

    const parsed = RowSchema.safeParse({
      count: raw.count,
      unitType: raw.unitType,
      status: raw.status,
      amountEgp: raw.amountEgp,
    });
    if (!parsed.success) {
      throw new ExcelParseError(`${rowLabel}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }

    if (parsed.data.count !== 1) countWarnedNonOne++;
    if (parsed.data.amountEgp !== 50000) amountWarnedOff++;

    statusCounts[parsed.data.status]++;
    typeCounts[parsed.data.unitType]++;
    totalValueEgp += BigInt(parsed.data.amountEgp);

    records.push({
      sourceRowIndex: r,
      count: parsed.data.count,
      unitType: parsed.data.unitType,
      status: parsed.data.status,
      eoiDate,
      amountEgp: parsed.data.amountEgp,
    });
  }

  if (records.length === 0) {
    throw new ExcelParseError("no data rows after header");
  }

  if (countWarnedNonOne > 0) {
    warnings.push(`${countWarnedNonOne} rows had Count of EOI != 1`);
  }
  if (amountWarnedOff > 0) {
    warnings.push(`${amountWarnedOff} rows had Amount of EOI != 50000`);
  }

  const sortedDates = records.map((r) => r.eoiDate).sort();
  const dateMin = sortedDates[0];
  const dateMax = sortedDates[sortedDates.length - 1];
  const dayDiff =
    (Date.parse(dateMax) - Date.parse(dateMin)) / 86400000;
  if (dayDiff > 90) {
    warnings.push(`date range spans ${Math.round(dayDiff)} days (>90)`);
  }

  return {
    records,
    summary: {
      rowCount: records.length,
      dateMin,
      dateMax,
      totalCount: records.reduce((acc, r) => acc + r.count, 0),
      totalValueEgp,
      statusCounts,
      typeCounts,
      warnings,
    },
  };
}
