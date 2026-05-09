"use client";

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
import { DailyBarChart, StatusDoughnut, TypeCompositionBar } from "./charts";
import { DownloadPdfButton } from "./download-pdf-button";

type SortKey = "date" | "count" | "value" | "approved" | "pending" | "rejected";

export function DashboardView({ initial }: { initial: DashboardData }) {
  // Live data: starts as the server-rendered initial, refreshes via polling.
  const [live, setLive] = useState(initial);
  const [newPublishAvailable, setNewPublishAvailable] = useState(false);

  // Filter state.
  const [rangePreset, setRangePreset] = useState<"7" | "30" | "all" | "custom">("all");
  const [customStart, setCustomStart] = useState<string | null>(null);
  const [customEnd, setCustomEnd] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<EoiStatus[]>([]);
  const [types, setTypes] = useState<UnitType[]>([]);
  const [valueMode, setValueMode] = useState<"count" | "value">("count");
  const [stacked, setStacked] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "asc",
  });

  // Derive the effective filter object.
  const filter: FilterState = useMemo(() => {
    let start: string | null = null;
    let end: string | null = null;
    const max = live.upload.dateMax;
    if (rangePreset === "7") {
      const max_ = new Date(max);
      const from = new Date(max_.getTime() - 6 * 86400000);
      start = isoDate(from);
      end = max;
    } else if (rangePreset === "30") {
      const max_ = new Date(max);
      const from = new Date(max_.getTime() - 29 * 86400000);
      start = isoDate(from);
      end = max;
    } else if (rangePreset === "custom") {
      start = customStart;
      end = customEnd;
    }
    return {
      rangeStart: start,
      rangeEnd: end,
      statuses,
      types,
    };
  }, [rangePreset, customStart, customEnd, statuses, types, live.upload.dateMax]);

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
      <section className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
            Daily EOI Tracker
          </p>
          <h1 className="font-serif text-3xl text-charcoal">Expression of Interest Report</h1>
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
          {(["7", "30", "all", "custom"] as const).map((r) => (
            <Chip
              key={r}
              active={rangePreset === r}
              onClick={() => setRangePreset(r)}
            >
              {r === "7" ? "Last 7 days" : r === "30" ? "Last 30 days" : r === "all" ? "Full window" : "Custom"}
            </Chip>
          ))}
          {rangePreset === "custom" ? (
            <span className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                min={live.upload.dateMin}
                max={live.upload.dateMax}
                value={customStart ?? ""}
                onChange={(e) => setCustomStart(e.target.value || null)}
                className="text-xs rounded border border-slate-200 px-1.5 py-0.5"
              />
              <span className="text-xs text-slate-500">to</span>
              <input
                type="date"
                min={live.upload.dateMin}
                max={live.upload.dateMax}
                value={customEnd ?? ""}
                onChange={(e) => setCustomEnd(e.target.value || null)}
                className="text-xs rounded border border-slate-200 px-1.5 py-0.5"
              />
            </span>
          ) : null}
        </Group>

        <Divider />

        <Group label="Status">
          {(["approved", "pending", "rejected"] as const).map((s) => (
            <Chip
              key={s}
              active={statuses.includes(s)}
              onClick={() =>
                setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
              }
            >
              {capitalize(s)}
            </Chip>
          ))}
        </Group>

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
            setRangePreset("all");
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
        <h2 className="font-serif text-xl text-charcoal">Approved · Pending · Rejected</h2>
        <p className="text-sm text-slate-600 mt-0.5 mb-3">
          Status mix across the current selection.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatusCard
            label="Approved"
            count={data.statusBreakdown.approved.count}
            value={data.statusBreakdown.approved.value}
            total={data.totals.totalCount}
            tone="approved"
          />
          <StatusCard
            label="Pending"
            count={data.statusBreakdown.pending.count}
            value={data.statusBreakdown.pending.value}
            total={data.totals.totalCount}
            tone="pending"
          />
          <StatusCard
            label="Rejected"
            count={data.statusBreakdown.rejected.count}
            value={data.statusBreakdown.rejected.value}
            total={data.totals.totalCount}
            tone="rejected"
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
          />
          <TypeCard
            label="Admin"
            tag="Commercial"
            count={data.typeBreakdown.Admin.count}
            value={data.typeBreakdown.Admin.value}
            total={data.totals.totalCount}
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
        <span>
          <span className="font-sans font-bold text-sakneen-blue">sakneen</span> · {data.client.displayName}
        </span>
        <span>Last updated {formatTimestamp(data.upload.publishedAt)}</span>
      </footer>
    </main>
  );
}

function isoDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
}: {
  label: string;
  count: number;
  value: number;
  total: number;
  tone: "approved" | "pending" | "rejected";
}) {
  const accent =
    tone === "approved" ? "bg-status-approved" : tone === "pending" ? "bg-status-pending" : "bg-status-rejected";
  const pill =
    tone === "approved"
      ? "bg-pill-approved-bg text-pill-approved-fg"
      : tone === "pending"
        ? "bg-pill-pending-bg text-pill-pending-fg"
        : "bg-pill-rejected-bg text-pill-rejected-fg";
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className={`h-1 ${accent}`} />
      <div className="p-4">
        <span
          className={`inline-block font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${pill}`}
        >
          ● {label}
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
    <div
      className={`rounded-xl p-5 ${
        featured ? "bg-warm-cream" : "bg-white border border-slate-200"
      }`}
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
      <p className="text-sm text-slate-600 mt-0.5">of total EOI volume by count</p>
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
    </div>
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
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Avoid an unused-export lint error.
void formatDateLong;
