import type { EoiUpload } from "@/db/schema";

export type EoiStatus = "approved" | "pending" | "rejected";
export type UnitType = "Residential" | "Admin";

export type DailyBucket = {
  date: string; // YYYY-MM-DD
  count: number;
  value: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  approvedValue: number;
  pendingValue: number;
  rejectedValue: number;
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
  };
  typeBreakdown: {
    Residential: { count: number; value: number };
    Admin: { count: number; value: number };
  };
  daily: DailyBucket[];
  records: Array<{
    eoiDate: string;
    unitType: UnitType;
    status: EoiStatus;
    amountEgp: number;
  }>;
};

export type DashboardRecordRow = {
  eoiDate: string;
  unitType: UnitType;
  status: EoiStatus;
  amountEgp: number;
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
  };
  const type = {
    Residential: { count: 0, value: 0 },
    Admin: { count: 0, value: 0 },
  };

  const flatRecords: DashboardData["records"] = [];

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

    let bucket = daily.get(dateKey);
    if (!bucket) {
      bucket = {
        date: dateKey,
        count: 0,
        value: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        approvedValue: 0,
        pendingValue: 0,
        rejectedValue: 0,
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
    } else {
      bucket.rejectedCount += 1;
      bucket.rejectedValue += amount;
    }

    flatRecords.push({
      eoiDate: dateKey,
      unitType: t,
      status: s,
      amountEgp: amount,
    });
  }

  const dailyArr = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
  const activeDays = dailyArr.length;

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
    })),
  });
}
