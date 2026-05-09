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
    })
    .from(eoiRecords)
    .where(and(eq(eoiRecords.uploadId, uploadId), eq(eoiRecords.clientId, client.id)));

  const data = buildDashboard({
    client: { slug: client.slug, displayName: client.displayName },
    upload,
    records: records.map((r) => ({
      eoiDate: String(r.eoiDate),
      unitType: r.unitType as "Residential" | "Admin",
      status: r.status as "approved" | "pending" | "rejected",
      amountEgp: Number(r.amountEgp),
    })),
  });

  const totalValue = data.totals.totalValueEgp;
  const totalApproved = data.statusBreakdown.approved.count;
  const totalPending = data.statusBreakdown.pending.count;
  const totalRejected = data.statusBreakdown.rejected.count;

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
        <h3 className="section-title-sm">Approved · Pending · Rejected</h3>
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
        </div>

        <div className="chart-block">
          <p className="chart-title">Status Composition</p>
          <p className="chart-sub">Share of total EOIs by status</p>
          <PrintStatusDoughnut
            approved={totalApproved}
            pending={totalPending}
            rejected={totalRejected}
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
        <h2 className="section-title">Stacked View · Approved · Pending · Rejected</h2>
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

      {/* PAGE 6 — Daily Ledger */}
      <section className="page">
        <PrintHeader client={client.displayName} pageNumber={6} />
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
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td className="right tabular">{formatCount(data.totals.totalCount)}</td>
              <td className="right tabular">{formatCount(totalValue)}</td>
              <td className="right tabular">{formatCount(totalApproved)}</td>
              <td className="right tabular">{formatCount(totalPending)}</td>
              <td className="right tabular">{formatCount(totalRejected)}</td>
            </tr>
          </tbody>
        </table>

        <PrintFooter pageNumber={6} client={client.displayName} />
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
  tone: "approved" | "pending" | "rejected";
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
