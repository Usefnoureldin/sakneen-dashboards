import type { EoiUpload } from "@/db/schema";

export type EoiStatus = "approved" | "pending" | "rejected" | "canceled";
export type UnitType = "Residential" | "Admin";

export type DailyBucket = {
  date: string; // YYYY-MM-DD
  count: number;
  value: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  canceledCount: number;
  approvedValue: number;
  pendingValue: number;
  rejectedValue: number;
  canceledValue: number;
};

export type DashboardData = {
  client: {
    slug: string;
    displayName: string;
  };
  upload: {
    id: string;
    publishedAt: string | null;
    fileName: string;
    dateMin: string;
    dateMax: string;
  };
  totals: {
    rowCount: number;
    totalCount: number;
    totalValueEgp: number;
    activeDays: number;
    avgPerActiveDay: number;
    avgValuePerActiveDay: number;
    peakDay: { date: string; count: number };
    peakValueDay: { date: string; value: number };
  };
  statusBreakdown: {
    approved: { count: number; value: number };
    pending: { count: number; value: number };
    rejected: { count: number; value: number };
    canceled: { count: number; value: number };
  };
  typeBreakdown: {
    Residential: { count: number; value: number };
    Admin: { count: number; value: number };
  };
  daily: DailyBucket[];
  nationalityBreakdown: NationalityRow[];
  bulkSegments: BulkSegment[];
  bulkTotals: { groups: number; units: number; value: number };
  directVsIndirect: {
    Direct: CategoryBreakdown;
    Indirect: CategoryBreakdown;
  };
  brokerPerformance: BrokerRow[];
  records: Array<{
    eoiDate: string;
    unitType: UnitType;
    status: EoiStatus;
    amountEgp: number;
    bulkEoiId: string | null;
    eoiCategory: string | null;
    eoiSource: string | null;
    nationality: string | null;
    brokerageName: string | null;
  }>;
};

export type NationalityRow = {
  name: string; // "Egypt", "Saudi Arabia", "Other", "Unknown"
  count: number;
  value: number;
};

export type BulkSegment = {
  bucket: "1" | "2" | "3-5" | "6-10" | "10-20" | "20+";
  /** Number of distinct Bulk EOI groups whose row count falls in this bucket. */
  groups: number;
  /** Total EOI rows (units) across those groups. */
  units: number;
  /** Total EOI value (EGP) across those groups. */
  value: number;
};

export type CategoryBreakdown = {
  count: number;
  value: number;
  /** Per-source rollup (e.g. Broker, Self-generated, Ambassador). */
  sources: Array<{ name: string; count: number; value: number }>;
  /** Top 5 brokers within this category (by EOI count). Useful for Indirect where
   * the source rollup is uninformative ("Broker" 100%). */
  topBrokers: Array<{ name: string; count: number; value: number }>;
};

export type BrokerRow = {
  name: string;
  count: number;
  value: number;
  /** True for the synthetic "Other" rollup row. */
  isOther?: boolean;
};

export type DashboardRecordRow = {
  eoiDate: string;
  unitType: UnitType;
  status: EoiStatus;
  amountEgp: number;
  bulkEoiId?: string | null;
  eoiCategory?: string | null;
  eoiSource?: string | null;
  nationality?: string | null;
  brokerageName?: string | null;
};

export function buildDashboard(args: {
  client: { slug: string; displayName: string };
  upload: EoiUpload;
  records: DashboardRecordRow[];
}): DashboardData {
  const { client, upload, records } = args;

  const totalCount = records.length;
  let totalValueEgp = 0;

  const daily = new Map<string, DailyBucket>();
  const status = {
    approved: { count: 0, value: 0 },
    pending: { count: 0, value: 0 },
    rejected: { count: 0, value: 0 },
    canceled: { count: 0, value: 0 },
  };
  const type = {
    Residential: { count: 0, value: 0 },
    Admin: { count: 0, value: 0 },
  };

  const flatRecords: DashboardData["records"] = [];

  // For the new derivations.
  const nationalityRaw = new Map<string, { count: number; value: number }>();
  const brokerRaw = new Map<string, { count: number; value: number }>();
  const categoryRaw: Record<
    "Direct" | "Indirect",
    {
      count: number;
      value: number;
      sources: Map<string, { count: number; value: number }>;
      brokers: Map<string, { count: number; value: number }>;
    }
  > = {
    Direct: { count: 0, value: 0, sources: new Map(), brokers: new Map() },
    Indirect: { count: 0, value: 0, sources: new Map(), brokers: new Map() },
  };
  const bulkGroups = new Map<string, { units: number; value: number }>();

  for (const r of records) {
    const dateKey = String(r.eoiDate);
    const amount = Number(r.amountEgp);
    totalValueEgp += amount;

    const s = r.status as EoiStatus;
    const t = r.unitType as UnitType;

    status[s].count += 1;
    status[s].value += amount;
    type[t].count += 1;
    type[t].value += amount;

    // Nationality (blank → "Unknown").
    const nat = r.nationality?.trim() || "Unknown";
    const nb = nationalityRaw.get(nat) ?? { count: 0, value: 0 };
    nb.count += 1;
    nb.value += amount;
    nationalityRaw.set(nat, nb);

    // Broker (blank → "Direct (in-house)" per spec).
    const broker = r.brokerageName?.trim() || "Direct (in-house)";
    const bb = brokerRaw.get(broker) ?? { count: 0, value: 0 };
    bb.count += 1;
    bb.value += amount;
    brokerRaw.set(broker, bb);

    // Direct vs Indirect with nested source.
    const catRaw = r.eoiCategory?.trim();
    const cat: "Direct" | "Indirect" | null =
      catRaw === "Direct" ? "Direct" : catRaw === "Indirect" ? "Indirect" : null;
    if (cat) {
      const cb = categoryRaw[cat];
      cb.count += 1;
      cb.value += amount;
      const srcName = r.eoiSource?.trim() || "Unspecified";
      const sb = cb.sources.get(srcName) ?? { count: 0, value: 0 };
      sb.count += 1;
      sb.value += amount;
      cb.sources.set(srcName, sb);
      // Per-category broker tally. Blank brokerage rolled up as "Direct (in-house)"
      // to mirror the sitewide broker-performance section.
      const brokerName = r.brokerageName?.trim() || "Direct (in-house)";
      const bb = cb.brokers.get(brokerName) ?? { count: 0, value: 0 };
      bb.count += 1;
      bb.value += amount;
      cb.brokers.set(brokerName, bb);
    }

    // Bulk EOI grouping (rows in same Bulk ID = one group).
    if (r.bulkEoiId !== null && r.bulkEoiId !== undefined) {
      const g = bulkGroups.get(r.bulkEoiId) ?? { units: 0, value: 0 };
      g.units += 1;
      g.value += amount;
      bulkGroups.set(r.bulkEoiId, g);
    }

    let bucket = daily.get(dateKey);
    if (!bucket) {
      bucket = {
        date: dateKey,
        count: 0,
        value: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        canceledCount: 0,
        approvedValue: 0,
        pendingValue: 0,
        rejectedValue: 0,
        canceledValue: 0,
      };
      daily.set(dateKey, bucket);
    }
    bucket.count += 1;
    bucket.value += amount;
    if (s === "approved") {
      bucket.approvedCount += 1;
      bucket.approvedValue += amount;
    } else if (s === "pending") {
      bucket.pendingCount += 1;
      bucket.pendingValue += amount;
    } else if (s === "rejected") {
      bucket.rejectedCount += 1;
      bucket.rejectedValue += amount;
    } else {
      bucket.canceledCount += 1;
      bucket.canceledValue += amount;
    }

    flatRecords.push({
      eoiDate: dateKey,
      unitType: t,
      status: s,
      amountEgp: amount,
      bulkEoiId: r.bulkEoiId ?? null,
      eoiCategory: r.eoiCategory ?? null,
      eoiSource: r.eoiSource ?? null,
      nationality: r.nationality ?? null,
      brokerageName: r.brokerageName ?? null,
    });
  }

  const dailyArr = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
  const activeDays = dailyArr.length;

  // Nationality: top 8 by count, rest rolled into "Other". Unknown stays separate at the end.
  const NAT_TOP_N = 8;
  const natEntries = [...nationalityRaw.entries()].map(([name, v]) => ({ name, ...v }));
  const unknownNat = natEntries.find((n) => n.name === "Unknown");
  const namedNat = natEntries
    .filter((n) => n.name !== "Unknown")
    .sort((a, b) => b.count - a.count);
  const topNat = namedNat.slice(0, NAT_TOP_N);
  const restNat = namedNat.slice(NAT_TOP_N);
  const nationalityBreakdown: NationalityRow[] = [...topNat];
  if (restNat.length > 0) {
    nationalityBreakdown.push({
      name: "Other",
      count: restNat.reduce((s, n) => s + n.count, 0),
      value: restNat.reduce((s, n) => s + n.value, 0),
    });
  }
  if (unknownNat) nationalityBreakdown.push(unknownNat);

  // Bulk segments.
  const bucketize = (units: number): BulkSegment["bucket"] => {
    if (units === 1) return "1";
    if (units === 2) return "2";
    if (units <= 5) return "3-5";
    if (units <= 10) return "6-10";
    if (units <= 20) return "10-20";
    return "20+";
  };
  const bulkSegmentsMap: Record<BulkSegment["bucket"], BulkSegment> = {
    "1": { bucket: "1", groups: 0, units: 0, value: 0 },
    "2": { bucket: "2", groups: 0, units: 0, value: 0 },
    "3-5": { bucket: "3-5", groups: 0, units: 0, value: 0 },
    "6-10": { bucket: "6-10", groups: 0, units: 0, value: 0 },
    "10-20": { bucket: "10-20", groups: 0, units: 0, value: 0 },
    "20+": { bucket: "20+", groups: 0, units: 0, value: 0 },
  };
  let bulkUnitsTotal = 0;
  let bulkValueTotal = 0;
  for (const g of bulkGroups.values()) {
    const b = bulkSegmentsMap[bucketize(g.units)];
    b.groups += 1;
    b.units += g.units;
    b.value += g.value;
    bulkUnitsTotal += g.units;
    bulkValueTotal += g.value;
  }
  const bulkSegments: BulkSegment[] = (["1", "2", "3-5", "6-10", "10-20", "20+"] as const).map(
    (k) => bulkSegmentsMap[k],
  );
  const bulkTotals = { groups: bulkGroups.size, units: bulkUnitsTotal, value: bulkValueTotal };

  // Direct vs Indirect: sort sources within each category by count desc.
  const top5Brokers = (m: Map<string, { count: number; value: number }>) =>
    [...m.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  const directVsIndirect: DashboardData["directVsIndirect"] = {
    Direct: {
      count: categoryRaw.Direct.count,
      value: categoryRaw.Direct.value,
      sources: [...categoryRaw.Direct.sources.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.count - a.count),
      topBrokers: top5Brokers(categoryRaw.Direct.brokers),
    },
    Indirect: {
      count: categoryRaw.Indirect.count,
      value: categoryRaw.Indirect.value,
      sources: [...categoryRaw.Indirect.sources.entries()]
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.count - a.count),
      topBrokers: top5Brokers(categoryRaw.Indirect.brokers),
    },
  };

  // Brokers: top 10 by count + Other.
  const BROKER_TOP_N = 10;
  const brokerEntries = [...brokerRaw.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);
  const topBrokers = brokerEntries.slice(0, BROKER_TOP_N);
  const restBrokers = brokerEntries.slice(BROKER_TOP_N);
  const brokerPerformance: BrokerRow[] = [...topBrokers];
  if (restBrokers.length > 0) {
    brokerPerformance.push({
      name: `Other (${restBrokers.length} brokers)`,
      count: restBrokers.reduce((s, b) => s + b.count, 0),
      value: restBrokers.reduce((s, b) => s + b.value, 0),
      isOther: true,
    });
  }

  const peakDay = dailyArr.reduce(
    (max, d) => (d.count > max.count ? { date: d.date, count: d.count } : max),
    { date: dailyArr[0]?.date ?? "", count: 0 },
  );
  const peakValueDay = dailyArr.reduce(
    (max, d) => (d.value > max.value ? { date: d.date, value: d.value } : max),
    { date: dailyArr[0]?.date ?? "", value: 0 },
  );

  return {
    client,
    upload: {
      id: upload.id,
      publishedAt: upload.publishedAt ? new Date(upload.publishedAt).toISOString() : null,
      fileName: upload.fileName,
      dateMin: String(upload.dateMin),
      dateMax: String(upload.dateMax),
    },
    totals: {
      rowCount: upload.rowCount,
      totalCount,
      totalValueEgp,
      activeDays,
      avgPerActiveDay: activeDays === 0 ? 0 : Math.round(totalCount / activeDays),
      avgValuePerActiveDay: activeDays === 0 ? 0 : Math.round(totalValueEgp / activeDays),
      peakDay,
      peakValueDay,
    },
    statusBreakdown: status,
    typeBreakdown: type,
    daily: dailyArr,
    nationalityBreakdown,
    bulkSegments,
    bulkTotals,
    directVsIndirect,
    brokerPerformance,
    records: flatRecords,
  };
}

export type FilterState = {
  rangeStart: string | null; // YYYY-MM-DD
  rangeEnd: string | null;
  statuses: EoiStatus[]; // empty = all
  types: UnitType[]; // empty = all
};

export function applyFilters(data: DashboardData, filter: FilterState): DashboardData {
  const allStatuses = filter.statuses.length === 0;
  const allTypes = filter.types.length === 0;
  const noRange = !filter.rangeStart && !filter.rangeEnd;
  if (allStatuses && allTypes && noRange) return data;

  const filtered = data.records.filter((r) => {
    if (filter.rangeStart && r.eoiDate < filter.rangeStart) return false;
    if (filter.rangeEnd && r.eoiDate > filter.rangeEnd) return false;
    if (!allStatuses && !filter.statuses.includes(r.status)) return false;
    if (!allTypes && !filter.types.includes(r.unitType)) return false;
    return true;
  });

  // Re-aggregate.
  const upload = {
    id: data.upload.id,
    publishedAt: data.upload.publishedAt ? new Date(data.upload.publishedAt) : null,
    fileName: data.upload.fileName,
    dateMin: data.upload.dateMin,
    dateMax: data.upload.dateMax,
    rowCount: data.totals.rowCount,
  };
  return buildDashboard({
    client: data.client,
    upload: upload as unknown as EoiUpload,
    records: filtered.map((r) => ({
      eoiDate: r.eoiDate,
      unitType: r.unitType,
      status: r.status,
      amountEgp: r.amountEgp,
      bulkEoiId: r.bulkEoiId,
      eoiCategory: r.eoiCategory,
      eoiSource: r.eoiSource,
      nationality: r.nationality,
      brokerageName: r.brokerageName,
    })),
  });
}
