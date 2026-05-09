import { readFileSync } from "node:fs";
import { parseEoiWorkbook, ExcelParseError } from "../src/lib/excel-parser";

let failed = 0;
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
}

console.log("=== happy path: standardized fixture ===");
{
  const buf = readFileSync("handoff/reference/sample_eoi_export_standardized.xlsx");
  const { records, summary } = parseEoiWorkbook(buf);
  check("638 records", records.length === 638, `got ${records.length}`);
  check("dateMin = 2026-04-09", summary.dateMin === "2026-04-09", `got ${summary.dateMin}`);
  check("dateMax = 2026-05-04", summary.dateMax === "2026-05-04", `got ${summary.dateMax}`);
  check("totalCount = 638", summary.totalCount === 638, `got ${summary.totalCount}`);
  check("totalValueEgp = 31,900,000", summary.totalValueEgp === 31_900_000n, `got ${summary.totalValueEgp}`);
  check("approved 427", summary.statusCounts.approved === 427, `got ${summary.statusCounts.approved}`);
  check("pending 169", summary.statusCounts.pending === 169, `got ${summary.statusCounts.pending}`);
  check("rejected 42", summary.statusCounts.rejected === 42, `got ${summary.statusCounts.rejected}`);
  check("Residential 490", summary.typeCounts.Residential === 490, `got ${summary.typeCounts.Residential}`);
  check("Admin 148", summary.typeCounts.Admin === 148, `got ${summary.typeCounts.Admin}`);
  check("no warnings", summary.warnings.length === 0, summary.warnings.join(" | "));
}

console.log("\n=== legacy file should be rejected loudly ===");
{
  const buf = readFileSync("handoff/reference/sample_eoi_export.xlsx");
  try {
    parseEoiWorkbook(buf);
    check("threw ExcelParseError", false, "no throw");
  } catch (e) {
    if (e instanceof ExcelParseError) {
      check("threw ExcelParseError", true, e.message.slice(0, 80) + "...");
    } else {
      check("threw ExcelParseError", false, `wrong error: ${(e as Error).message}`);
    }
  }
}

console.log("\n=== empty buffer should be rejected ===");
{
  try {
    parseEoiWorkbook(new Uint8Array(0));
    check("threw on empty", false);
  } catch (e) {
    check("threw on empty", e instanceof ExcelParseError, (e as Error).message.slice(0, 80));
  }
}

console.log("");
console.log(failed === 0 ? "ALL OK" : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
