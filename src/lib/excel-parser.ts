import * as XLSX from "xlsx";
import { z } from "zod";

/**
 * EOI Excel parser. Accepts the canonical Sakneen export format:
 *
 *   - Sheet whose name starts with "Export EOI Requests"
 *   - Wide schema with named columns (we look up by name, not position):
 *       count alias:  "Number of EOI" or "Count of EOI"
 *       unit type:    "Unit Type"
 *       status:       "Status"
 *       timestamp:    "Timestamp"
 *       amount alias: "EOI Value" or "Amount of EOI"
 *   - Timestamps may be:
 *       text "DD-MM-YYYY" or "DD/MM/YYYY", OR
 *       Excel serial numbers (with day/month swap to undo Excel's mis-parse of
 *       Egyptian DD-MM-YYYY as US MM-DD-YYYY)
 *   - Rows missing a unit type or with an unknown unit type are dropped
 *   - Rows with an unsupported status are dropped
 *   - Blank rows are dropped
 *
 * Drops are surfaced via summary.warnings so admins can see what was skipped.
 */

export const UNIT_TYPES = ["Residential", "Admin"] as const;
export const STATUSES = ["approved", "pending", "rejected", "canceled"] as const;

export type UnitType = (typeof UNIT_TYPES)[number];
export type EoiStatus = (typeof STATUSES)[number];

const HEADER_ALIASES = {
  count: ["Number of EOI", "Count of EOI"],
  unitType: ["Unit Type"],
  status: ["Status"],
  timestamp: ["Timestamp"],
  amount: ["EOI Value", "Amount of EOI"],
  bulkId: ["Bulk EOI"],
  category: ["EOI Category"],
  source: ["EOI Source"],
  nationality: ["Nationality"],
  brokerage: ["Brokerage name", "Brokerage Name"],
} as const;

const KNOWN_UNIT_TYPES = new Set<string>(UNIT_TYPES);
const KNOWN_STATUSES = new Set<string>(STATUSES);

export type ParsedRecord = {
  /** zero-based row index in the source sheet (excluding header) */
  sourceRowIndex: number;
  count: number;
  unitType: UnitType;
  status: EoiStatus;
  /** YYYY-MM-DD, no time component */
  eoiDate: string;
  amountEgp: number;
  bulkEoiId: string | null;
  eoiCategory: string | null;
  eoiSource: string | null;
  nationality: string | null;
  brokerageName: string | null;
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

const dateRegex = /^(\d{2})[-/](\d{2})[-/](\d{4})$/;

function parseTextDate(s: string, rowLabel: string): string {
  const m = s.match(dateRegex);
  if (!m) {
    throw new ExcelParseError(
      `${rowLabel}: timestamp string must be DD-MM-YYYY or DD/MM/YYYY (got ${JSON.stringify(s)})`,
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

function serialToUtcDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

/**
 * Convert Excel serial date back to YYYY-MM-DD with day/month SWAP.
 * Excel sees the original "DD-MM-YYYY" Egyptian text and mis-reads it as US
 * "MM-DD-YYYY". We reverse that by treating UTC month as the real day, and UTC
 * day as the real month. Validated against the reference file (09 Apr - 04 May
 * 2026 round-trip).
 */
function parseSerialDate(serial: number, rowLabel: string): string {
  const utc = serialToUtcDate(serial);
  const realDay = utc.getUTCMonth() + 1;
  const realMonth = utc.getUTCDate();
  if (realMonth < 1 || realMonth > 12) {
    throw new ExcelParseError(
      `${rowLabel}: serial ${serial} produced invalid month after swap`,
    );
  }
  return `${utc.getUTCFullYear()}-${String(realMonth).padStart(2, "0")}-${String(realDay).padStart(2, "0")}`;
}

const RowSchema = z.object({
  count: z.number().int().min(0),
  amountEgp: z.number().int().min(0),
});

function findColumn(header: unknown[], aliases: readonly string[], logicalName: string): number {
  for (const alias of aliases) {
    const i = header.indexOf(alias);
    if (i >= 0) return i;
  }
  throw new ExcelParseError(
    `could not find column for "${logicalName}". Tried: ${aliases.map((a) => `"${a}"`).join(", ")}. ` +
      `Header was: ${JSON.stringify(header)}`,
  );
}

function optionalColumn(header: unknown[], aliases: readonly string[]): number {
  for (const alias of aliases) {
    const i = header.indexOf(alias);
    if (i >= 0) return i;
  }
  return -1;
}

function readOptionalText(row: unknown[], colIdx: number): string | null {
  if (colIdx < 0) return null;
  const v = row[colIdx];
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function readOptionalNumber(row: unknown[], colIdx: number): number | null {
  if (colIdx < 0) return null;
  const v = row[colIdx];
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

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
  const cols = {
    count: findColumn(header, HEADER_ALIASES.count, "count"),
    unitType: findColumn(header, HEADER_ALIASES.unitType, "unit type"),
    status: findColumn(header, HEADER_ALIASES.status, "status"),
    timestamp: findColumn(header, HEADER_ALIASES.timestamp, "timestamp"),
    amount: findColumn(header, HEADER_ALIASES.amount, "amount"),
    // Optional columns: present in the wide schema, missing in the legacy narrow one.
    bulkId: optionalColumn(header, HEADER_ALIASES.bulkId),
    category: optionalColumn(header, HEADER_ALIASES.category),
    source: optionalColumn(header, HEADER_ALIASES.source),
    nationality: optionalColumn(header, HEADER_ALIASES.nationality),
    brokerage: optionalColumn(header, HEADER_ALIASES.brokerage),
  };

  const records: ParsedRecord[] = [];
  const statusCounts: Record<EoiStatus, number> = {
    approved: 0,
    pending: 0,
    rejected: 0,
    canceled: 0,
  };
  const typeCounts: Record<UnitType, number> = { Residential: 0, Admin: 0 };
  let totalValueEgp = 0n;

  let blankDropped = 0;
  const reasonCounts: Record<string, number> = {};
  const noteDrop = (reason: string) => {
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowLabel = `row ${r}`;

    const allBlank = row.every((c) => c === null || c === undefined || c === "");
    if (allBlank) {
      blankDropped++;
      continue;
    }

    const countRaw = row[cols.count];
    if (countRaw === null || countRaw === undefined || countRaw === "") {
      blankDropped++;
      continue;
    }

    const unitTypeRaw = row[cols.unitType];
    if (unitTypeRaw === null || unitTypeRaw === undefined || unitTypeRaw === "") {
      noteDrop("missing unit type");
      continue;
    }
    const unitType = String(unitTypeRaw);
    if (!KNOWN_UNIT_TYPES.has(unitType)) {
      noteDrop(`unknown unit type "${unitType}"`);
      continue;
    }

    const statusRaw = row[cols.status];
    const status =
      typeof statusRaw === "string"
        ? statusRaw.toLowerCase()
        : String(statusRaw ?? "").toLowerCase();
    if (!KNOWN_STATUSES.has(status)) {
      noteDrop(`unsupported status "${status}"`);
      continue;
    }

    const ts = row[cols.timestamp];
    let eoiDate: string;
    if (typeof ts === "string") {
      eoiDate = parseTextDate(ts, rowLabel);
    } else if (typeof ts === "number") {
      eoiDate = parseSerialDate(ts, rowLabel);
    } else {
      throw new ExcelParseError(
        `${rowLabel}: timestamp must be text DD-MM-YYYY or Excel serial number (got ${typeof ts}: ${JSON.stringify(ts)})`,
      );
    }

    const amountRaw = row[cols.amount];
    const parsed = RowSchema.safeParse({
      count: typeof countRaw === "number" ? countRaw : Number(countRaw),
      amountEgp: typeof amountRaw === "number" ? amountRaw : Number(amountRaw),
    });
    if (!parsed.success) {
      throw new ExcelParseError(
        `${rowLabel}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
    }

    statusCounts[status as EoiStatus]++;
    typeCounts[unitType as UnitType]++;
    totalValueEgp += BigInt(parsed.data.amountEgp);

    records.push({
      sourceRowIndex: r,
      count: parsed.data.count,
      unitType: unitType as UnitType,
      status: status as EoiStatus,
      eoiDate,
      amountEgp: parsed.data.amountEgp,
      bulkEoiId: readOptionalText(row, cols.bulkId),
      eoiCategory: readOptionalText(row, cols.category),
      eoiSource: readOptionalText(row, cols.source),
      nationality: readOptionalText(row, cols.nationality),
      brokerageName: readOptionalText(row, cols.brokerage),
    });
  }

  if (records.length === 0) {
    throw new ExcelParseError("no usable data rows after header");
  }

  const warnings: string[] = [];
  if (blankDropped > 0) {
    warnings.push(`${blankDropped} blank rows dropped`);
  }
  for (const [reason, n] of Object.entries(reasonCounts)) {
    warnings.push(`${n} rows dropped: ${reason}`);
  }

  const sortedDates = records.map((r) => r.eoiDate).sort();
  const dateMin = sortedDates[0];
  const dateMax = sortedDates[sortedDates.length - 1];
  const dayDiff = (Date.parse(dateMax) - Date.parse(dateMin)) / 86400000;
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
