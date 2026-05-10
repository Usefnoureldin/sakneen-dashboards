import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, eoiRecords, eoiUploads } from "@/db/schema";
import { buildDashboard } from "@/lib/aggregations";
import {
  formatCount,
  formatDateRange,
  formatDateShort,
  formatPercent,
  formatValueLong,
  formatValueShort,
} from "@/lib/format";
import { verifyPdfToken } from "@/lib/pdf-token";
import {
  PrintBrokersChart,
  PrintBulkChart,
  PrintDailyChart,
  PrintReadyMarker,
  PrintStatusDoughnut,
  PrintTypeBar,
} from "./print-charts";
import "./print.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PrintReport({
  params,
  searchParams,
}: {
  params: Promise<{ uploadId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { uploadId } = await params;
  const { token } = await searchParams;

  if (!token) notFound();
  const payload = verifyPdfToken(token);
  if (!payload || payload.uploadId !== uploadId) notFound();

  const [upload] = await db.select().from(eoiUploads).where(eq(eoiUploads.id, uploadId)).limit(1);
  if (!upload) notFound();
  const [client] = await db.select().from(clients).where(eq(clients.id, upload.clientId)).limit(1);
  if (!client) notFound();

  const records = await db
    .select({
      eoiDate: eoiRecords.eoiDate,
      unitType: eoiRecords.unitType,
      status: eoiRecords.status,
      amountEgp: eoiRecords.amountEgp,
      bulkEoiId: eoiRecords.bulkEoiId,
      eoiCategory: eoiRecords.eoiCategory,
      eoiSource: eoiRecords.eoiSource,
      nationality: eoiRecords.nationality,
      brokerageName: eoiRecords.brokerageName,
    })
    .from(eoiRecords)
    .where(and(eq(eoiRecords.uploadId, uploadId), eq(eoiRecords.clientId, client.id)));

  const data = buildDashboard({
    client: { slug: client.slug, displayName: client.displayName },
    upload,
    records: records.map((r) => ({
      eoiDate: String(r.eoiDate),
      unitType: r.unitType as "Residential" | "Admin",
      status: r.status as "approved" | "pending" | "rejected" | "canceled",
      amountEgp: Number(r.amountEgp),
      bulkEoiId: r.bulkEoiId,
      eoiCategory: r.eoiCategory,
      eoiSource: r.eoiSource,
      nationality: r.nationality,
      brokerageName: r.brokerageName,
    })),
  });

  const totalValue = data.totals.totalValueEgp;
  const totalApproved = data.statusBreakdown.approved.count;
  const totalPending = data.statusBreakdown.pending.count;
  const totalRejected = data.statusBreakdown.rejected.count;
  const totalCanceled = data.statusBreakdown.canceled.count;

  return (
    <div className="print-root">
      {/* PAGE 1 — Cover */}
      <section className="page page-cover">
        <header className="page-header">
          <span className="brand">
            sakneen <span className="brand-line">| Enterprise</span>
          </span>
          <span className="header-eyebrow">Daily Performance Report</span>
        </header>

        <div className="cover-body">
          <p className="cover-eyebrow">{client.displayName.toUpperCase()} · EOI TRACKER</p>
          <h1 className="cover-title">Expression of Interest Report</h1>
          <p className="cover-sub">
            Daily breakdown of EOI volumes, value, status mix, and unit-type distribution across the
            reporting window.
          </p>
        </div>

        <div className="cover-meta">
          <div>
            <p className="meta-label">Reporting Period</p>
            <p className="meta-value">{formatDateRange(data.upload.dateMin, data.upload.dateMax)}</p>
          </div>
          <div>
            <p className="meta-label">Active Days</p>
            <p className="meta-value">{data.totals.activeDays}</p>
          </div>
          <div>
            <p className="meta-label">Prepared By</p>
            <p className="meta-value">Sakneen</p>
          </div>
        </div>
      </section>

      {/* PAGE 2 — Summary */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={2} />
        <p className="section-eyebrow">Summary</p>
        <h2 className="section-title">EOI Performance Snapshot</h2>
        <p className="section-sub">
          Reporting window {formatDateRange(data.upload.dateMin, data.upload.dateMax)} ·{" "}
          {data.totals.activeDays} active days · Total volume, value collected, and status
          distribution.
        </p>

        <div className="hero-grid">
          <div className="hero-card hero-blue">
            <p className="hero-label">Total EOIs Collected</p>
            <p className="hero-value">{formatCount(data.totals.totalCount)}</p>
            <p className="hero-unit">expressions of interest</p>
            <p className="hero-foot">
              Avg {formatCount(data.totals.avgPerActiveDay)} per active day · Peak{" "}
              {formatCount(data.totals.peakDay.count)} on {formatDateShort(data.totals.peakDay.date)}
            </p>
          </div>
          <div className="hero-card hero-terracotta">
            <p className="hero-label">Total Value Collected</p>
            <p className="hero-value">{formatValueShort(totalValue, false)}</p>
            <p className="hero-unit">{formatValueLong(totalValue)}</p>
            <p className="hero-foot">
              Avg {formatValueShort(data.totals.avgValuePerActiveDay)} per active day · Flat 50,000
              EGP per EOI
            </p>
          </div>
        </div>

        <div className="stat-grid">
          <Stat label="Active Days" value={formatCount(data.totals.activeDays)} sub="days with EOI activity" />
          <Stat label="Avg / Active Day" value={formatCount(data.totals.avgPerActiveDay)} sub="EOIs per day" />
          <Stat
            label="Peak Day"
            value={formatCount(data.totals.peakDay.count)}
            sub={`on ${formatDateShort(data.totals.peakDay.date)}`}
          />
          <Stat
            label="Avg Daily Value"
            value={formatValueShort(data.totals.avgValuePerActiveDay, false)}
            sub="EGP / day"
          />
        </div>

        <p className="section-eyebrow mt-md">Status Distribution</p>
        <h3 className="section-title-sm">Approved, Pending, Rejected, Canceled</h3>
        <p className="section-sub">Status mix across the full reporting window.</p>

        <div className="status-grid">
          <StatusCard
            label="Approved"
            tone="approved"
            count={totalApproved}
            value={data.statusBreakdown.approved.value}
            total={data.totals.totalCount}
          />
          <StatusCard
            label="Pending"
            tone="pending"
            count={totalPending}
            value={data.statusBreakdown.pending.value}
            total={data.totals.totalCount}
          />
          <StatusCard
            label="Rejected"
            tone="rejected"
            count={totalRejected}
            value={data.statusBreakdown.rejected.value}
            total={data.totals.totalCount}
          />
          <StatusCard
            label="Canceled"
            tone="canceled"
            count={totalCanceled}
            value={data.statusBreakdown.canceled.value}
            total={data.totals.totalCount}
          />
        </div>

        <div className="chart-block">
          <p className="chart-title">Status Composition</p>
          <p className="chart-sub">Share of total EOIs by status</p>
          <PrintStatusDoughnut
            approved={totalApproved}
            pending={totalPending}
            rejected={totalRejected}
            canceled={totalCanceled}
          />
        </div>

        <PrintFooter pageNumber={2} client={client.displayName} />
      </section>

      {/* PAGE 3 — Daily Activity */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={3} />
        <p className="section-eyebrow">Daily Activity</p>
        <h2 className="section-title">EOIs by Day · Count &amp; Value</h2>
        <p className="section-sub">
          Daily volume of expressions of interest with both totals and a status-stacked view on the
          next page.
        </p>

        <div className="chart-block">
          <p className="chart-title">Daily EOI Count</p>
          <p className="chart-sub">Total number of EOIs received per day</p>
          <PrintDailyChart data={data.daily} metric="count" stacked={false} height={220} />
        </div>

        <div className="chart-block">
          <p className="chart-title">Daily EOI Value</p>
          <p className="chart-sub">Total EGP value of EOIs received per day</p>
          <PrintDailyChart data={data.daily} metric="value" stacked={false} height={220} />
        </div>

        <PrintFooter pageNumber={3} client={client.displayName} />
      </section>

      {/* PAGE 4 — Stacked by Status */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={4} />
        <p className="section-eyebrow">Daily Activity by Status</p>
        <h2 className="section-title">Stacked View, Approved, Pending, Rejected, Canceled</h2>
        <p className="section-sub">
          Same daily timeline broken down by status. Useful for spotting days with high rejection
          or pending backlog.
        </p>

        <div className="chart-block">
          <p className="chart-title">Daily Count by Status</p>
          <p className="chart-sub">Number of EOIs per day, stacked by status</p>
          <PrintDailyChart data={data.daily} metric="count" stacked height={220} />
        </div>

        <div className="chart-block">
          <p className="chart-title">Daily Value by Status</p>
          <p className="chart-sub">EGP value per day, stacked by status</p>
          <PrintDailyChart data={data.daily} metric="value" stacked height={220} />
        </div>

        <PrintFooter pageNumber={4} client={client.displayName} />
      </section>

      {/* PAGE 5 — Type */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={5} />
        <p className="section-eyebrow">Unit Type</p>
        <h2 className="section-title">Residential vs. Admin Distribution</h2>
        <p className="section-sub">Share of EOIs by unit type, count and value.</p>

        <div className="type-grid">
          <TypeCard
            featured
            label="Residential"
            tag="Primary"
            count={data.typeBreakdown.Residential.count}
            value={data.typeBreakdown.Residential.value}
            total={data.totals.totalCount}
          />
          <TypeCard
            label="Admin"
            tag="Commercial"
            count={data.typeBreakdown.Admin.count}
            value={data.typeBreakdown.Admin.value}
            total={data.totals.totalCount}
          />
        </div>

        <div className="chart-block">
          <p className="chart-title">Type Composition</p>
          <p className="chart-sub">Residential vs. Admin · share by count and by value</p>
          <PrintTypeBar
            residentialCount={data.typeBreakdown.Residential.count}
            adminCount={data.typeBreakdown.Admin.count}
            residentialValue={data.typeBreakdown.Residential.value}
            adminValue={data.typeBreakdown.Admin.value}
          />
        </div>

        <PrintFooter pageNumber={5} client={client.displayName} />
      </section>

      {/* PAGE 6 — Channel Mix (Direct vs Indirect with Sources) */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={6} />
        <p className="section-eyebrow">Channel Mix</p>
        <h2 className="section-title">Direct vs Indirect</h2>
        <p className="section-sub">
          Where the EOIs came from, with per-source breakdown inside each channel.
        </p>

        <div className="type-grid">
          <PrintChannelCard
            label="Direct"
            featured
            entry={data.directVsIndirect.Direct}
            total={data.totals.totalCount}
          />
          <PrintChannelCard
            label="Indirect"
            entry={data.directVsIndirect.Indirect}
            total={data.totals.totalCount}
          />
        </div>

        <PrintFooter pageNumber={6} client={client.displayName} />
      </section>

      {/* PAGE 7 — Nationality */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={7} />
        <p className="section-eyebrow">Nationality</p>
        <h2 className="section-title">EOIs by Nationality</h2>
        <p className="section-sub">
          Top nationalities by count, with value and share of total.
        </p>

        <table className="ledger">
          <thead>
            <tr>
              <th>Nationality</th>
              <th className="right">Count</th>
              <th className="right">Value (EGP)</th>
              <th className="right">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.nationalityBreakdown.map((n) => (
              <tr key={n.name}>
                <td>{n.name}</td>
                <td className="right tabular">{formatCount(n.count)}</td>
                <td className="right tabular">{formatCount(n.value)}</td>
                <td className="right tabular">{formatPercent(n.count, data.totals.totalCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <PrintFooter pageNumber={7} client={client.displayName} />
      </section>

      {/* PAGE 8 — Bulk Units */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={8} />
        <p className="section-eyebrow">Bulk Units</p>
        <h2 className="section-title">Bulk EOI segmentation</h2>
        <p className="section-sub">
          {formatCount(data.bulkTotals.groups)} bulk groups across{" "}
          {formatCount(data.bulkTotals.units)} units, segmented by group size.
        </p>

        <table className="ledger">
          <thead>
            <tr>
              <th>Group size</th>
              <th className="right">Groups</th>
              <th className="right">Units</th>
              <th className="right">Value (EGP)</th>
              <th className="right">Share of groups</th>
            </tr>
          </thead>
          <tbody>
            {data.bulkSegments.map((s) => (
              <tr key={s.bucket}>
                <td>{s.bucket} unit{s.bucket === "1" ? "" : "s"}</td>
                <td className="right tabular">{formatCount(s.groups)}</td>
                <td className="right tabular">{formatCount(s.units)}</td>
                <td className="right tabular">{formatCount(s.value)}</td>
                <td className="right tabular">
                  {formatPercent(s.groups, data.bulkTotals.groups)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="chart-block">
          <p className="chart-title">Groups per segment</p>
          <p className="chart-sub">Number of bulk EOI groups in each size band</p>
          <PrintBulkChart data={data.bulkSegments} metric="groups" height={180} />
        </div>

        <PrintFooter pageNumber={8} client={client.displayName} />
      </section>

      {/* PAGE 9 — Broker Performance */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={9} />
        <p className="section-eyebrow">Broker Performance</p>
        <h2 className="section-title">Top brokers by EOI count</h2>
        <p className="section-sub">
          Top 10 brokers by EOI count. Blank brokerage cells are grouped as Direct (in-house).
          Remaining brokers rolled into &quot;Other&quot;.
        </p>

        <div className="chart-block">
          <PrintBrokersChart data={data.brokerPerformance} />
        </div>

        <table className="ledger">
          <thead>
            <tr>
              <th>Broker</th>
              <th className="right">Count</th>
              <th className="right">Value (EGP)</th>
              <th className="right">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.brokerPerformance.map((b) => (
              <tr key={b.name}>
                <td>{b.name}</td>
                <td className="right tabular">{formatCount(b.count)}</td>
                <td className="right tabular">{formatCount(b.value)}</td>
                <td className="right tabular">{formatPercent(b.count, data.totals.totalCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <PrintFooter pageNumber={9} client={client.displayName} />
      </section>

      {/* PAGE 10 — Daily Ledger */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={10} />
        <p className="section-eyebrow">Detail</p>
        <h2 className="section-title">Daily EOI Ledger</h2>
        <p className="section-sub">
          Full daily breakdown · count, value, and status split for every active day in the
          reporting window.
        </p>

        <table className="ledger">
          <thead>
            <tr>
              <th>Date</th>
              <th className="right">Count</th>
              <th className="right">Value (EGP)</th>
              <th className="right">Approved</th>
              <th className="right">Pending</th>
              <th className="right">Rejected</th>
              <th className="right">Canceled</th>
            </tr>
          </thead>
          <tbody>
            {data.daily.map((d) => (
              <tr key={d.date}>
                <td>{formatDateShort(d.date)}</td>
                <td className="right tabular">{formatCount(d.count)}</td>
                <td className="right tabular">{formatCount(d.value)}</td>
                <td className="right tabular">{formatCount(d.approvedCount)}</td>
                <td className="right tabular">{formatCount(d.pendingCount)}</td>
                <td className="right tabular">{formatCount(d.rejectedCount)}</td>
                <td className="right tabular">{formatCount(d.canceledCount)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td className="right tabular">{formatCount(data.totals.totalCount)}</td>
              <td className="right tabular">{formatCount(totalValue)}</td>
              <td className="right tabular">{formatCount(totalApproved)}</td>
              <td className="right tabular">{formatCount(totalPending)}</td>
              <td className="right tabular">{formatCount(totalRejected)}</td>
              <td className="right tabular">{formatCount(totalCanceled)}</td>
            </tr>
          </tbody>
        </table>

        <PrintFooter pageNumber={10} client={client.displayName} />
      </section>

      <PrintReadyMarker />
    </div>
  );
}

function PrintHeader({ client, pageNumber }: { client: string; pageNumber: number }) {
  return (
    <header className="page-header">
      <span className="brand">
        sakneen <span className="brand-line">| Enterprise</span>
      </span>
      <span className="header-eyebrow">
        {client.toUpperCase()} · PAGE {String(pageNumber).padStart(2, "0")}
      </span>
    </header>
  );
}

function PrintFooter({ pageNumber, client }: { pageNumber: number; client: string }) {
  return (
    <footer className="page-footer">
      <span>
        SAKNEEN · {client.toUpperCase()} EOI REPORT
      </span>
      <span>PAGE {String(pageNumber).padStart(2, "0")}</span>
    </footer>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-sub">{sub}</p>
    </div>
  );
}

function StatusCard({
  label,
  tone,
  count,
  value,
  total,
}: {
  label: string;
  tone: "approved" | "pending" | "rejected" | "canceled";
  count: number;
  value: number;
  total: number;
}) {
  return (
    <div className={`status-card status-${tone}`}>
      <span className={`status-pill pill-${tone}`}>● {label}</span>
      <p className="status-pct">{formatPercent(count, total)}</p>
      <div className="status-meta">
        <p>
          <span className="status-meta-label">Count</span> {formatCount(count)}
        </p>
        <p>
          <span className="status-meta-label">Value</span> {formatValueShort(value)}
        </p>
      </div>
    </div>
  );
}

function TypeCard({
  featured,
  label,
  tag,
  count,
  value,
  total,
}: {
  featured?: boolean;
  label: string;
  tag: string;
  count: number;
  value: number;
  total: number;
}) {
  return (
    <div className={`type-card ${featured ? "type-featured" : ""}`}>
      <div className="type-head">
        <p className="type-label">{label}</p>
        <span className={`type-tag ${featured ? "tag-featured" : ""}`}>{tag.toUpperCase()}</span>
      </div>
      <p className="type-pct">{formatPercent(count, total)}</p>
      <p className="type-of">of total EOI volume by count</p>
      <div className="type-meta">
        <div>
          <p className="type-meta-label">Count</p>
          <p className="type-meta-value">{formatCount(count)}</p>
        </div>
        <div>
          <p className="type-meta-label">Value (EGP)</p>
          <p className="type-meta-value">{formatValueShort(value, false)}</p>
        </div>
      </div>
    </div>
  );
}

function PrintChannelCard({
  label,
  featured,
  entry,
  total,
}: {
  label: "Direct" | "Indirect";
  featured?: boolean;
  entry: import("@/lib/aggregations").CategoryBreakdown;
  total: number;
}) {
  return (
    <div className={`type-card ${featured ? "type-featured" : ""}`}>
      <div className="type-head">
        <p className="type-label">{label}</p>
        <span className={`type-tag ${featured ? "tag-featured" : ""}`}>
          {label === "Direct" ? "IN-HOUSE" : "VIA BROKERS"}
        </span>
      </div>
      <p className="type-pct">{formatPercent(entry.count, total)}</p>
      <p className="type-of">
        {formatCount(entry.count)} EOIs · {formatValueShort(entry.value)}
      </p>
      {label === "Indirect" && entry.topBrokers.length > 0 ? (
        <table className="ledger" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Top brokers</th>
              <th className="right">Count</th>
              <th className="right">Share</th>
            </tr>
          </thead>
          <tbody>
            {entry.topBrokers.map((b) => (
              <tr key={b.name}>
                <td>{b.name}</td>
                <td className="right tabular">{formatCount(b.count)}</td>
                <td className="right tabular">{formatPercent(b.count, entry.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : entry.sources.length > 0 ? (
        <table className="ledger" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Source</th>
              <th className="right">Count</th>
              <th className="right">Share</th>
            </tr>
          </thead>
          <tbody>
            {entry.sources.map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td className="right tabular">{formatCount(s.count)}</td>
                <td className="right tabular">{formatPercent(s.count, entry.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
