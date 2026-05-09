import * as XLSX from "xlsx";

/**
 * Transitional helper. Converts a legacy Sakneen EOI export (mixed Date/string
 * cells, blank rows) into the standardized format we agreed in
 * handoff/docs/09-open-decisions.md decision #2: dates as text DD-MM-YYYY,
 * no blank rows, fixed columns.
 *
 * Used by:
 *   - scripts/convert-legacy-xlsx.ts (one-off CLI)
 *   - the admin upload route, when the user opts into "legacy auto-convert"
 *
 * Delete this file once standardization has fully rolled out at the export source.
 */

const EXPECTED_HEADERS = [
  "Count of EOI",
  "Unit Type",
  "Status",
  "Timestamp",
  "Amount of EOI",
] as const;

export class LegacyConvertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacyConvertError";
  }
}

function serialToUtcDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

/** Recover the source DD-MM-YYYY string from a legacy Excel-serial date cell. */
function legacyDateToDdMm(serial: number): string {
  const utc = serialToUtcDate(serial);
  const realDay = utc.getUTCMonth() + 1;
  const realMonth = utc.getUTCDate();
  return `${String(realDay).padStart(2, "0")}-${String(realMonth).padStart(2, "0")}-${utc.getUTCFullYear()}`;
}

export type ConvertResult = {
  buffer: Buffer;
  rowCount: number;
  blankRowsDropped: number;
};

export function convertLegacyToStandardized(input: Buffer | ArrayBuffer | Uint8Array): ConvertResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(input, { cellDates: false });
  } catch (e) {
    throw new LegacyConvertError(`could not read xlsx: ${(e as Error).message}`);
  }

  const sheetName = wb.SheetNames.find((n) => n.startsWith("Export EOI Requests"));
  if (!sheetName) {
    throw new LegacyConvertError(
      `no sheet named "Export EOI Requests" found. sheets: ${wb.SheetNames.join(", ")}`,
    );
  }
  const sheet = wb.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  const header = rows[0];
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (header[i] !== EXPECTED_HEADERS[i]) {
      throw new LegacyConvertError(
        `header[${i}] expected "${EXPECTED_HEADERS[i]}", got ${JSON.stringify(header[i])}`,
      );
    }
  }

  const out: unknown[][] = [Array.from(EXPECTED_HEADERS)];
  let dropped = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const count = row[0];
    const ts = row[3];

    if (count === undefined || count === null || count === "") {
      dropped++;
      continue;
    }

    let dateText: string;
    if (typeof ts === "string" && /^\d{2}-\d{2}-\d{4}$/.test(ts)) {
      dateText = ts;
    } else if (typeof ts === "number") {
      dateText = legacyDateToDdMm(ts);
    } else {
      throw new LegacyConvertError(
        `row ${r}: cannot convert timestamp ${JSON.stringify(ts)}`,
      );
    }

    out.push([Number(count), String(row[1]), String(row[2]), dateText, Number(row[4])]);
  }

  const outSheet = XLSX.utils.aoa_to_sheet(out);
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, outSheet, "Export EOI Requests");
  const buffer = XLSX.write(outWb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, rowCount: out.length - 1, blankRowsDropped: dropped };
}
