"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  applyFilters,
  type DashboardData,
  type EoiStatus,
  type FilterState,
  type UnitType,
} from "@/lib/aggregations";
import {
  formatCount,
  formatDateLong,
  formatDateRange,
  formatDateShort,
  formatPercent,
  formatTimestamp,
  formatValueLong,
  formatValueShort,
} from "@/lib/format";
import {
  BrokersBarChart,
  BulkBucketsChart,
  DailyBarChart,
  StatusDoughnut,
  TypeCompositionBar,
} from "./charts";
import { DateRangePicker } from "./date-range-picker";
import { DownloadPdfButton } from "./download-pdf-button";
import { DetailModal, type DetailKey } from "./detail-modal";

type SortKey = "date" | "count" | "value" | "approved" | "pending" | "rejected" | "canceled";

export function DashboardView({ initial }: { initial: DashboardData }) {
  // Live data: starts as the server-rendered initial, refreshes via polling.
  const [live, setLive] = useState(initial);
  const [newPublishAvailable, setNewPublishAvailable] = useState(false);

  // Filter state.
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<EoiStatus[]>([]);
  const [types, setTypes] = useState<UnitType[]>([]);
  const [valueMode, setValueMode] = useState<"count" | "value">("count");
  const [stacked, setStacked] = useState(false);
  const [bulkMetric, setBulkMetric] = useState<"groups" | "value">("groups");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "asc",
  });
  const [openDetail, setOpenDetail] = useState<DetailKey>(null);

  // Derive the effective filter object.
  const filter: FilterState = useMemo(
    () => ({
      rangeStart: customStart,
      rangeEnd: customEnd,
      statuses,
      types,
    }),
    [customStart, customEnd, statuses, types],
  );

  const data = useMemo(() => applyFilters(live, filter), [live, filter]);

  // Polling for new publishes.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/dashboard/data", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        if (!body.data) return;
        const fresh: DashboardData = body.data;
        const oldTs = live.upload.publishedAt ?? "";
        const newTs = fresh.upload.publishedAt ?? "";
        if (newTs > oldTs && fresh.upload.id !== live.upload.id) {
          setNewPublishAvailable(true);
        }
      } catch {
        // ignore
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [live.upload.publishedAt, live.upload.id]);

  async function refreshNow() {
    const res = await fetch("/api/dashboard/data", { cache: "no-store" });
    const body = await res.json();
    if (body.data) {
      setLive(body.data);
      setNewPublishAvailable(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 pt-8 pb-16 space-y-6">
      {newPublishAvailable ? (
        <div className="rounded-md border border-sakneen-blue/30 bg-sakneen-blue/5 px-4 py-2 flex items-center justify-between">
          <span className="text-sm text-charcoal">
            New data available. Refresh to view the latest report.
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setNewPublishAvailable(false)}
              className="text-xs px-3 py-1 rounded border border-slate-200 bg-white"
            >
              Dismiss
            </button>
            <button
              onClick={refreshNow}
              className="text-xs px-3 py-1 rounded bg-sakneen-blue text-white"
            >
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      {/* Title */}
      <section className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
            Daily EOI Tracker
          </p>
          <h1 className="font-serif text-3xl text-charcoal">
            <span className="sm:hidden">EOI Report</span>
            <span className="hidden sm:inline">Expression of Interest Report</span>
          </h1>
          <p className="text-sm text-slate-700 mt-1">
            {formatDateRange(data.upload.dateMin, data.upload.dateMax)} ·{" "}
            {data.totals.activeDays} active days · last published{" "}
            {formatTimestamp(data.upload.publishedAt)}
          </p>
        </div>
        <DownloadPdfButton />
      </section>

      {/* Filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-3">
        <Group label="Range">
          {(() => {
            const max = live.upload.dateMax;
            const min = live.upload.dateMin;
            const maxD = new Date(`${max}T00:00:00Z`);
            // Last 7 days inclusive of dateMax.
            const last7Start = new Date(maxD.getTime() - 6 * 86400000);
            const last7 = {
              start: clampToMin(toISO(last7Start), min),
              end: max,
            };
            // YTD: Jan 1 of the dateMax's year (clamped to dateMin).
            const ytdStartRaw = `${maxD.getUTCFullYear()}-01-01`;
            const ytd = { start: clampToMin(ytdStartRaw, min), end: max };
            const isLast7 = customStart === last7.start && customEnd === last7.end;
            const isYtd = customStart === ytd.start && customEnd === ytd.end;
            return (
              <>
                <Chip
                  active={isLast7}
                  onClick={() => {
                    setCustomStart(last7.start);
                    setCustomEnd(last7.end);
                  }}
                >
                  Last 7 days
                </Chip>
                <span className="hidden sm:inline-flex">
                  <Chip
                    active={isYtd}
                    onClick={() => {
                      setCustomStart(ytd.start);
                      setCustomEnd(ytd.end);
                    }}
                  >
                    YTD
                  </Chip>
                </span>
                <DateRangePicker
                  start={customStart}
                  end={customEnd}
                  min={min}
                  max={max}
                  onChange={({ start, end }) => {
                    setCustomStart(start);
                    setCustomEnd(end);
                  }}
                />
              </>
            );
          })()}
        </Group>

        <Divider />

        <div className="flex items-start sm:items-center gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 mr-1 mt-1.5 sm:mt-0">
            Status
          </span>
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
            {(["approved", "pending", "rejected", "canceled"] as const).map((s) => (
              <Chip
                key={s}
                active={statuses.includes(s)}
                onClick={() =>
                  setStatuses((prev) =>
                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
                  )
                }
              >
                {capitalize(s)}
              </Chip>
            ))}
          </div>
        </div>

        <Divider />

        <Group label="Type">
          {(["Residential", "Admin"] as const).map((t) => (
            <Chip
              key={t}
              active={types.includes(t)}
              onClick={() =>
                setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
              }
            >
              {t}
            </Chip>
          ))}
        </Group>

        <button
          onClick={() => {
            setCustomStart(null);
            setCustomEnd(null);
            setStatuses([]);
            setTypes([]);
          }}
          className="ml-auto text-xs text-slate-500 hover:text-charcoal"
        >
          Reset filters
        </button>
      </section>

      {/* Hero stats */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <HeroCard variant="blue">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-white/75 mb-1">
            Total EOIs Collected
          </p>
          <p className="font-serif text-5xl tracking-tight">{formatCount(data.totals.totalCount)}</p>
          <p className="text-sm text-white/85 mt-1">expressions of interest</p>
          <p className="border-t border-white/20 mt-3 pt-2 text-xs text-white/80">
            Avg {formatCount(data.totals.avgPerActiveDay)} per active day · Peak{" "}
            {formatCount(data.totals.peakDay.count)} on {formatDateShort(data.totals.peakDay.date)}
          </p>
        </HeroCard>
        <HeroCard variant="terracotta">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-white/75 mb-1">
            Total Value Collected
          </p>
          <p className="font-serif text-5xl tracking-tight">
            {formatValueShort(data.totals.totalValueEgp, false)}
          </p>
          <p className="text-sm text-white/85 mt-1">{formatValueLong(data.totals.totalValueEgp)}</p>
          <p className="border-t border-white/20 mt-3 pt-2 text-xs text-white/80">
            Avg {formatValueShort(data.totals.avgValuePerActiveDay)} per active day · Flat 50,000 EGP
            per EOI
          </p>
        </HeroCard>
      </section>

      {/* Stat grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Active Days"
          value={formatCount(data.totals.activeDays)}
          sub="days with EOI activity"
        />
        <StatCard
          label="Avg / Active Day"
          value={formatCount(data.totals.avgPerActiveDay)}
          sub="EOIs per day"
        />
        <StatCard
          label="Peak Day"
          value={formatCount(data.totals.peakDay.count)}
          sub={`on ${formatDateShort(data.totals.peakDay.date)}`}
        />
        <StatCard
          label="Avg Daily Value"
          value={formatValueShort(data.totals.avgValuePerActiveDay, false)}
          sub="EGP / day"
        />
      </section>

      {/* Status distribution */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
          Status Distribution
        </p>
        <h2 className="font-serif text-xl text-charcoal">Approved, Pending, Rejected, Canceled</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">
          Status mix across the current selection.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatusCard
            label="Approved"
            count={data.statusBreakdown.approved.count}
            value={data.statusBreakdown.approved.value}
            total={data.totals.totalCount}
            tone="approved"
            onClick={() => setOpenDetail("approved")}
          />
          <StatusCard
            label="Pending"
            count={data.statusBreakdown.pending.count}
            value={data.statusBreakdown.pending.value}
            total={data.totals.totalCount}
            tone="pending"
            onClick={() => setOpenDetail("pending")}
          />
          <StatusCard
            label="Rejected"
            count={data.statusBreakdown.rejected.count}
            value={data.statusBreakdown.rejected.value}
            total={data.totals.totalCount}
            tone="rejected"
            onClick={() => setOpenDetail("rejected")}
          />
          <StatusCard
            label="Canceled"
            count={data.statusBreakdown.canceled.count}
            value={data.statusBreakdown.canceled.value}
            total={data.totals.totalCount}
            tone="canceled"
            onClick={() => setOpenDetail("canceled")}
          />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500 mb-2">
            Status Composition
          </p>
          <StatusDoughnut
            approved={data.statusBreakdown.approved.count}
            pending={data.statusBreakdown.pending.count}
            rejected={data.statusBreakdown.rejected.count}
            canceled={data.statusBreakdown.canceled.count}
          />
        </div>
      </section>

      {/* Daily charts */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
          Daily Activity
        </p>
        <h2 className="font-serif text-xl text-charcoal">EOIs by Day</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">
          {valueMode === "count" ? "Total number of EOIs received per day" : "Total EGP value of EOIs received per day"}
          {stacked ? " — broken down by status." : "."}
        </p>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-serif text-base text-charcoal">
              {stacked
                ? valueMode === "count"
                  ? "Daily Count by Status"
                  : "Daily Value by Status"
                : valueMode === "count"
                  ? "Daily EOI Count"
                  : "Daily EOI Value"}
            </p>
            <div className="flex gap-1.5">
              <Toggle active={valueMode === "count"} onClick={() => setValueMode("count")}>
                Count
              </Toggle>
              <Toggle active={valueMode === "value"} onClick={() => setValueMode("value")}>
                Value
              </Toggle>
              <span className="w-px bg-slate-200 mx-1" />
              <Toggle active={stacked} onClick={() => setStacked((s) => !s)}>
                {stacked ? "Stacked" : "Show by status"}
              </Toggle>
            </div>
          </div>
          <DailyBarChart data={data.daily} metric={valueMode} stacked={stacked} />
        </div>
      </section>

      {/* Type distribution */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
          Unit Type
        </p>
        <h2 className="font-serif text-xl text-charcoal">Residential vs. Admin</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">Share of EOIs by unit type, count and value.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TypeCard
            featured
            label="Residential"
            tag="Primary"
            count={data.typeBreakdown.Residential.count}
            value={data.typeBreakdown.Residential.value}
            total={data.totals.totalCount}
            onClick={() => setOpenDetail("Residential")}
          />
          <TypeCard
            label="Admin"
            tag="Commercial"
            count={data.typeBreakdown.Admin.count}
            value={data.typeBreakdown.Admin.value}
            total={data.totals.totalCount}
            onClick={() => setOpenDetail("Admin")}
          />
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500 mb-2">
            Type Composition
          </p>
          <TypeCompositionBar
            residentialCount={data.typeBreakdown.Residential.count}
            adminCount={data.typeBreakdown.Admin.count}
            residentialValue={data.typeBreakdown.Residential.value}
            adminValue={data.typeBreakdown.Admin.value}
          />
        </div>
      </section>

      {/* Channel mix: Direct vs Indirect with sources */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
          Channel Mix
        </p>
        <h2 className="font-serif text-xl text-charcoal">Direct vs Indirect</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">
          Where the EOIs came from. Each channel breaks down by source.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChannelCard
            label="Direct"
            featured
            total={data.totals.totalCount}
            entry={data.directVsIndirect.Direct}
          />
          <ChannelCard
            label="Indirect"
            total={data.totals.totalCount}
            entry={data.directVsIndirect.Indirect}
          />
        </div>
      </section>

      {/* Nationality */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
          Nationality
        </p>
        <h2 className="font-serif text-xl text-charcoal">EOIs by Nationality</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">
          Top nationalities by count, with value and share of total.
        </p>
        <NationalityTable
          rows={data.nationalityBreakdown}
          totalCount={data.totals.totalCount}
        />
      </section>

      {/* Bulk units */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
          Bulk Units
        </p>
        <h2 className="font-serif text-xl text-charcoal">Bulk EOI segmentation</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">
          {formatCount(data.bulkTotals.groups)} bulk groups across{" "}
          {formatCount(data.bulkTotals.units)} units, segmented by group size.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {data.bulkSegments.map((seg) => (
            <BulkBucketCard
              key={seg.bucket}
              label={`${seg.bucket} unit${seg.bucket === "1" ? "" : "s"}`}
              groups={seg.groups}
              units={seg.units}
              value={seg.value}
              totalGroups={data.bulkTotals.groups}
              onClick={() => setOpenDetail(`bulk:${seg.bucket}` as DetailKey)}
            />
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-serif text-base text-charcoal">
              {bulkMetric === "groups" ? "Groups per segment" : "Total value per segment"}
            </p>
            <div className="flex gap-1.5">
              <Toggle active={bulkMetric === "groups"} onClick={() => setBulkMetric("groups")}>
                Groups
              </Toggle>
              <Toggle active={bulkMetric === "value"} onClick={() => setBulkMetric("value")}>
                Value
              </Toggle>
            </div>
          </div>
          <BulkBucketsChart data={data.bulkSegments} metric={bulkMetric} />
        </div>
      </section>

      {/* Broker performance */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
          Broker Performance
        </p>
        <h2 className="font-serif text-xl text-charcoal">Top brokers by EOI count</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">
          Top 10 brokers by EOI count. Blank brokerage cells are grouped as Direct (in-house).
          Remaining brokers rolled into &quot;Other&quot;.
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <BrokersBarChart data={data.brokerPerformance} />
        </div>
      </section>

      {/* Daily ledger */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
          Detail
        </p>
        <h2 className="font-serif text-xl text-charcoal">Daily EOI Ledger</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">
          Full daily breakdown — count, value, and status split for every active day in the
          current selection.
        </p>
        <Ledger daily={data.daily} sort={sort} setSort={setSort} totals={data.totals} />
      </section>

      <footer className="pt-6 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
        <span className="inline-flex items-center gap-2">
          <Image
            src="/logo/sakneen-logo.png"
            alt="Sakneen"
            width={67}
            height={20}
            className="h-5 w-auto"
          />
          <span>· {data.client.displayName}</span>
        </span>
        <span>Last updated {formatTimestamp(data.upload.publishedAt)}</span>
      </footer>

      <DetailModal open={openDetail} onClose={() => setOpenDetail(null)} data={data} />
    </main>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function clampToMin(s: string, min: string): string {
  return s < min ? min : s;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 mr-1">
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return <span className="hidden sm:inline w-px h-5 bg-slate-200" />;
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${
        active
          ? "bg-sakneen-blue text-white border-sakneen-blue"
          : "bg-white text-charcoal border-slate-200 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-md border ${
        active
          ? "bg-charcoal text-white border-charcoal"
          : "bg-white text-charcoal border-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function HeroCard({
  variant,
  children,
}: {
  variant: "blue" | "terracotta";
  children: React.ReactNode;
}) {
  const bg = variant === "blue" ? "bg-sakneen-blue" : "bg-terracotta";
  return <div className={`${bg} text-white rounded-xl p-6`}>{children}</div>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">{label}</p>
      <p className="font-sans text-xl font-semibold text-charcoal mt-1">{value}</p>
      <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

function StatusCard({
  label,
  count,
  value,
  total,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  value: number;
  total: number;
  tone: "approved" | "pending" | "rejected" | "canceled";
  onClick?: () => void;
}) {
  const accent =
    tone === "approved"
      ? "bg-status-approved"
      : tone === "pending"
        ? "bg-status-pending"
        : tone === "rejected"
          ? "bg-status-rejected"
          : "bg-status-canceled";
  const pill =
    tone === "approved"
      ? "bg-pill-approved-bg text-pill-approved-fg"
      : tone === "pending"
        ? "bg-pill-pending-bg text-pill-pending-fg"
        : tone === "rejected"
          ? "bg-pill-rejected-bg text-pill-rejected-fg"
          : "bg-pill-canceled-bg text-pill-canceled-fg";
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-slate-200 bg-white overflow-hidden cursor-pointer transition-all hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sakneen-blue/40 group"
    >
      <div className={`h-1 ${accent}`} />
      <div className="p-4 relative">
        <span
          className={`inline-block font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${pill}`}
        >
          ● {label}
        </span>
        <span className="absolute top-3 right-3 font-mono text-[9px] uppercase tracking-[1.5px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Click for daily
        </span>
        <p className="font-serif text-3xl text-charcoal mt-3">{formatPercent(count, total)}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[1.5px] text-slate-500">Count</p>
            <p className="font-semibold tabular-nums">{formatCount(count)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[1.5px] text-slate-500">Value</p>
            <p className="font-semibold tabular-nums">{formatValueShort(value)}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function TypeCard({
  featured,
  label,
  tag,
  count,
  value,
  total,
  onClick,
}: {
  featured?: boolean;
  label: string;
  tag: string;
  count: number;
  value: number;
  total: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left w-full rounded-xl p-5 transition-all cursor-pointer hover:shadow-sm hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sakneen-blue/40 group bg-white border border-slate-200 hover:border-slate-300`}
    >
      <div className="flex items-baseline justify-between">
        <p className="font-serif text-xl text-charcoal">{label}</p>
        <span
          className={`font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${
            featured ? "bg-terracotta text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {tag}
        </span>
      </div>
      <p className="font-serif text-5xl text-charcoal mt-3">{formatPercent(count, total)}</p>
      <p className="text-sm text-slate-600 mt-0.5 flex items-baseline justify-between">
        <span>of total EOI volume by count</span>
        <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          Click for daily
        </span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">Count</p>
          <p className="font-semibold tabular-nums">{formatCount(count)}</p>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">
            Value (EGP)
          </p>
          <p className="font-semibold tabular-nums">{formatValueShort(value, false)}</p>
        </div>
      </div>
    </button>
  );
}

function Ledger({
  daily,
  sort,
  setSort,
  totals,
}: {
  daily: import("@/lib/aggregations").DailyBucket[];
  sort: { key: SortKey; dir: "asc" | "desc" };
  setSort: (s: { key: SortKey; dir: "asc" | "desc" }) => void;
  totals: DashboardData["totals"];
}) {
  const sorted = useMemo(() => {
    const arr = [...daily];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sort.key) {
        case "date":
          av = a.date;
          bv = b.date;
          break;
        case "count":
          av = a.count;
          bv = b.count;
          break;
        case "value":
          av = a.value;
          bv = b.value;
          break;
        case "approved":
          av = a.approvedCount;
          bv = b.approvedCount;
          break;
        case "pending":
          av = a.pendingCount;
          bv = b.pendingCount;
          break;
        case "rejected":
          av = a.rejectedCount;
          bv = b.rejectedCount;
          break;
        case "canceled":
          av = a.canceledCount;
          bv = b.canceledCount;
          break;
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [daily, sort]);

  const totalValue = daily.reduce((s, d) => s + d.value, 0);
  const totalApproved = daily.reduce((s, d) => s + d.approvedCount, 0);
  const totalPending = daily.reduce((s, d) => s + d.pendingCount, 0);
  const totalRejected = daily.reduce((s, d) => s + d.rejectedCount, 0);
  const totalCanceled = daily.reduce((s, d) => s + d.canceledCount, 0);

  function H({ k, label, alignRight }: { k: SortKey; label: string; alignRight?: boolean }) {
    const active = sort.key === k;
    return (
      <th
        scope="col"
        className={`px-4 py-2 font-mono text-[9px] uppercase tracking-[1.5px] cursor-pointer select-none ${
          alignRight ? "text-right" : "text-left"
        } ${active ? "text-charcoal" : "text-slate-500 hover:text-charcoal"}`}
        onClick={() =>
          setSort({ key: k, dir: active && sort.dir === "asc" ? "desc" : "asc" })
        }
      >
        {label}
        {active ? <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span> : null}
      </th>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <H k="date" label="Date" />
            <H k="count" label="Count" alignRight />
            <H k="value" label="Value (EGP)" alignRight />
            <H k="approved" label="Approved" alignRight />
            <H k="pending" label="Pending" alignRight />
            <H k="rejected" label="Rejected" alignRight />
            <H k="canceled" label="Canceled" alignRight />
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.date} className="border-t border-slate-100">
              <td className="px-4 py-2 font-mono text-[11px] text-slate-700">
                {formatDateShort(d.date)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(d.count)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatCount(d.value)}</td>
              <td className="px-4 py-2 text-right tabular-nums text-status-approved">
                {formatCount(d.approvedCount)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-status-pending">
                {formatCount(d.pendingCount)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-status-rejected">
                {formatCount(d.rejectedCount)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-status-canceled">
                {formatCount(d.canceledCount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50">
            <td className="px-4 py-2 font-mono text-[10px] uppercase tracking-[1.5px] text-slate-700">
              Total
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-semibold">
              {formatCount(totals.totalCount)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-semibold">
              {formatCount(totalValue)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-semibold text-status-approved">
              {formatCount(totalApproved)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-semibold text-status-pending">
              {formatCount(totalPending)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-semibold text-status-rejected">
              {formatCount(totalRejected)}
            </td>
            <td className="px-4 py-2 text-right tabular-nums font-semibold text-status-canceled">
              {formatCount(totalCanceled)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ChannelCard({
  label,
  featured,
  total,
  entry,
}: {
  label: "Direct" | "Indirect";
  featured?: boolean;
  total: number;
  entry: import("@/lib/aggregations").CategoryBreakdown;
}) {
  return (
    <div
      className="rounded-xl p-5 bg-white border border-slate-200"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-serif text-xl text-charcoal">{label}</p>
        <span
          className={`font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${
            featured ? "bg-terracotta text-white" : "bg-slate-100 text-slate-700"
          }`}
        >
          {label === "Direct" ? "In-house" : "Via brokers"}
        </span>
      </div>
      <p className="font-serif text-5xl text-charcoal mt-3">{formatPercent(entry.count, total)}</p>
      <p className="text-sm text-slate-600 mt-0.5">
        {formatCount(entry.count)} EOIs · {formatValueShort(entry.value)}
      </p>
      {/* For Direct: show source breakdown (Self-generated, Ambassador, etc).
          For Indirect: source is always "Broker", so show top 5 brokers instead. */}
      {label === "Indirect" && entry.topBrokers.length > 0 ? (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 mb-2">
            Top brokers
          </p>
          <ul className="space-y-1.5">
            {entry.topBrokers.map((b) => (
              <li key={b.name} className="flex items-baseline justify-between text-sm gap-3">
                <span className="text-charcoal truncate">{b.name}</span>
                <span className="text-slate-500 tabular-nums shrink-0">
                  {formatCount(b.count)}{" "}
                  <span className="text-slate-400">({formatPercent(b.count, entry.count)})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : entry.sources.length > 0 ? (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 mb-2">
            Sources
          </p>
          <ul className="space-y-1.5">
            {entry.sources.map((s) => (
              <li key={s.name} className="flex items-baseline justify-between text-sm">
                <span className="text-charcoal">{s.name}</span>
                <span className="text-slate-500 tabular-nums">
                  {formatCount(s.count)}{" "}
                  <span className="text-slate-400">({formatPercent(s.count, entry.count)})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function NationalityTable({
  rows,
  totalCount,
}: {
  rows: import("@/lib/aggregations").NationalityRow[];
  totalCount: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 text-left">
              Nationality
            </th>
            <th className="px-4 py-2 font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 text-right">
              Count
            </th>
            <th className="px-4 py-2 font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 text-right">
              Value
            </th>
            <th className="px-4 py-2 font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 text-right">
              Share
            </th>
            <th className="px-4 py-2 font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 text-left w-[35%]">
              Distribution
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = totalCount === 0 ? 0 : (r.count / totalCount) * 100;
            return (
              <tr key={r.name} className="border-t border-slate-100">
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-right tabular-nums font-semibold">
                  {formatCount(r.count)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatValueShort(r.value)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                  {pct.toFixed(1)}%
                </td>
                <td className="px-4 py-2">
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sakneen-blue rounded-full"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BulkBucketCard({
  label,
  groups,
  units,
  value,
  totalGroups,
  onClick,
}: {
  label: string;
  groups: number;
  units: number;
  value: number;
  totalGroups: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={groups === 0}
      className="text-left rounded-xl border border-slate-200 bg-white p-3 transition-all cursor-pointer hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-sakneen-blue/40 disabled:opacity-50 disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-none"
    >
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">{label}</p>
      <p className="font-serif text-2xl text-charcoal mt-1">{formatCount(groups)}</p>
      <p className="text-[11px] text-slate-500">
        groups · {formatPercent(groups, totalGroups)}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
        <div>
          <p className="text-slate-500">Units</p>
          <p className="tabular-nums font-semibold">{formatCount(units)}</p>
        </div>
        <div>
          <p className="text-slate-500">Value</p>
          <p className="tabular-nums font-semibold">{formatValueShort(value, false)}</p>
        </div>
      </div>
    </button>
  );
}

// Avoid an unused-export lint error.
void formatDateLong;
