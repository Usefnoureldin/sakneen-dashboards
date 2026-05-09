/**
 * One-off transitional script. Converts a legacy Sakneen EOI export (mixed Date/string
 * cells, blank rows) into the standardized format we agreed in handoff/docs/09-open-decisions.md
 * decision #2: dates as text DD-MM-YYYY, no blank rows, fixed columns.
 *
 * Usage:
 *   pnpm exec tsx scripts/convert-legacy-xlsx.ts <input.xlsx> <output.xlsx>
 *
 * Delete this script once standardization has fully rolled out at the export source.
 */

import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("usage: tsx scripts/convert-legacy-xlsx.ts <input.xlsx> <output.xlsx>");
  process.exit(1);
}

function serialToUtcDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

/** For a legacy Date/serial cell, recover the source DD-MM-YYYY by swapping day and month. */
function legacyDateToDdMm(serial: number): string {
  const utc = serialToUtcDate(serial);
  const realDay = utc.getUTCMonth() + 1;
  const realMonth = utc.getUTCDate();
  return `${String(realDay).padStart(2, "0")}-${String(realMonth).padStart(2, "0")}-${utc.getUTCFullYear()}`;
}

const wb = XLSX.read(readFileSync(inputPath), { cellDates: false });
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

const header = rows[0];
const expected = ["Count of EOI", "Unit Type", "Status", "Timestamp", "Amount of EOI"];
for (let i = 0; i < expected.length; i++) {
  if (header[i] !== expected[i]) {
    console.error(`header[${i}] expected "${expected[i]}", got "${header[i]}"`);
    process.exit(1);
  }
}

const out: unknown[][] = [expected];
let dropped = 0;
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const count = row[0];
  const type = row[1];
  const status = row[2];
  const ts = row[3];
  const amount = row[4];

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
    console.error(`row ${r}: unparseable timestamp cell ${JSON.stringify(ts)}`);
    process.exit(1);
  }

  out.push([Number(count), String(type), String(status), dateText, Number(amount)]);
}

const outSheet = XLSX.utils.aoa_to_sheet(out);
const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, outSheet, "Export EOI Requests");
writeFileSync(outputPath, XLSX.write(outWb, { type: "buffer", bookType: "xlsx" }));

console.log(`wrote ${outputPath}: ${out.length - 1} data rows (${dropped} blank rows dropped)`);
