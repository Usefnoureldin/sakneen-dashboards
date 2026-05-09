/**
 * Formatting helpers — keep in sync with handoff/docs/04-data-model.md "Number formatting".
 * No em dashes in user-facing copy. Use ` - ` for ranges.
 */

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parts(yyyyMmDd: string): { y: number; m: number; d: number } {
  const [y, m, d] = yyyyMmDd.split("-").map((p) => Number(p));
  return { y, m, d };
}

export function formatDateLong(yyyyMmDd: string): string {
  const { y, m, d } = parts(yyyyMmDd);
  return `${String(d).padStart(2, "0")} ${MONTHS_LONG[m - 1]} ${y}`;
}

export function formatDateShort(yyyyMmDd: string): string {
  const { m, d } = parts(yyyyMmDd);
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]}`;
}

export function formatDateRange(min: string, max: string): string {
  return `${formatDateLong(min)} - ${formatDateLong(max)}`;
}

export function formatCount(n: number | bigint): string {
  return Number(n).toLocaleString("en-US");
}

export function formatValueShort(egp: number | bigint, withCurrency = true): string {
  const n = Number(egp);
  let body: string;
  if (n >= 1_000_000) body = `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  else if (n >= 1_000) body = `${(n / 1_000).toFixed(0)}K`;
  else body = n.toString();
  return withCurrency ? `${body} EGP` : body;
}

export function formatValueLong(egp: number | bigint): string {
  return `${Number(egp).toLocaleString("en-US")} EGP`;
}

export function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function formatTimestamp(iso: Date | string | null): string {
  if (!iso) return "never";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Cairo",
  }).format(d);
}
