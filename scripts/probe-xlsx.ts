import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";

const file = "handoff/reference/sample_eoi_export.xlsx";
const wb = XLSX.read(readFileSync(file), { cellDates: false });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

function serialToUtcDate(serial: number): Date {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}

// Strategy: read raw serial → UTC components, then SWAP day/month to recover the original
// Egyptian DD-MM-YYYY interpretation that Excel mis-parsed as MM-DD-YYYY.
// String cells already parse as DD-MM-YYYY; no swap needed.
function legacyParseDate(v: unknown): string | null {
  if (typeof v === "string") {
    const m = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!m) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (typeof v === "number") {
    const utc = serialToUtcDate(v);
    const realDay = utc.getUTCMonth() + 1;
    const realMonth = utc.getUTCDate();
    return `${utc.getUTCFullYear()}-${String(realMonth).padStart(2, "0")}-${String(realDay).padStart(2, "0")}`;
  }
  return null;
}

const dates: string[] = [];
let blank = 0;
let bad = 0;
for (let i = 1; i < rows.length; i++) {
  const v = rows[i]?.[3];
  if (v === undefined || v === null || v === "") {
    blank++;
    continue;
  }
  const d = legacyParseDate(v);
  if (!d) {
    bad++;
    continue;
  }
  dates.push(d);
}
const uniq = [...new Set(dates)].sort();
console.log("LEGACY PARSE (raw serial + swap):");
console.log(`  total rows parsed: ${dates.length}`);
console.log(`  blank skipped:     ${blank}`);
console.log(`  bad skipped:       ${bad}`);
console.log(`  unique dates:      ${uniq.length}`);
console.log(`  min: ${uniq[0]}`);
console.log(`  max: ${uniq[uniq.length - 1]}`);
console.log(`  all dates:`, uniq);

// Gap analysis
let gaps = 0;
for (let i = 1; i < uniq.length; i++) {
  const a = new Date(uniq[i - 1] + "T00:00:00Z");
  const b = new Date(uniq[i] + "T00:00:00Z");
  const days = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (days > 1) {
    gaps++;
    console.log(`  gap ${days}d between ${uniq[i - 1]} and ${uniq[i]}`);
  }
}
console.log(`  total gaps: ${gaps}`);
