"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyBucket } from "@/lib/aggregations";
import { formatCount, formatDateShort, formatValueShort } from "@/lib/format";

const BLUE = "#2109C4";
const TERRACOTTA = "#C84B31";
const GREEN = "#4FB54E";
const AMBER = "#F59E0B";
const GRAY = "#6B7280";
const SLATE_GRID = "#DDE2EB";

const tooltipStyle = {
  background: "#fff",
  border: `1px solid ${SLATE_GRID}`,
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
};

type TipPayload = {
  name?: unknown;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: Record<string, unknown>;
};
type TipProps = { active?: boolean; payload?: readonly TipPayload[]; label?: unknown };

function tipNum(p: TipPayload): number {
  if (typeof p.value === "number") return p.value;
  if (typeof p.value === "string") {
    const n = Number(p.value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function tipName(p: TipPayload): string {
  return typeof p.name === "string" ? p.name : String(p.name ?? "");
}
function tipLabel(label: unknown): string {
  return typeof label === "string" ? label : String(label ?? "");
}

function CountTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length || label === undefined || label === "") return null;
  const total = payload.reduce((s, p) => s + tipNum(p), 0);
  return (
    <div style={tooltipStyle}>
      <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">
        {formatDateShort(tipLabel(label))}
      </div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex justify-between gap-4 text-[12px] text-slate-700">
          <span style={{ color: p.color }}>● {tipName(p)}</span>
          <span className="tabular-nums font-semibold">{formatCount(tipNum(p))}</span>
        </div>
      ))}
      {payload.length > 1 ? (
        <div className="mt-1 pt-1 border-t border-slate-200 flex justify-between text-[12px]">
          <span className="text-slate-500">Total</span>
          <span className="tabular-nums font-semibold">{formatCount(total)}</span>
        </div>
      ) : null}
    </div>
  );
}

function ValueTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length || label === undefined || label === "") return null;
  const total = payload.reduce((s, p) => s + tipNum(p), 0);
  return (
    <div style={tooltipStyle}>
      <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">
        {formatDateShort(tipLabel(label))}
      </div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex justify-between gap-4 text-[12px] text-slate-700">
          <span style={{ color: p.color }}>● {tipName(p)}</span>
          <span className="tabular-nums font-semibold">{formatValueShort(tipNum(p))}</span>
        </div>
      ))}
      {payload.length > 1 ? (
        <div className="mt-1 pt-1 border-t border-slate-200 flex justify-between text-[12px]">
          <span className="text-slate-500">Total</span>
          <span className="tabular-nums font-semibold">{formatValueShort(total)}</span>
        </div>
      ) : null}
    </div>
  );
}

function chartAxisProps() {
  return {
    tick: { fill: "#374151", fontSize: 10, fontFamily: "var(--font-sans)" },
    axisLine: { stroke: SLATE_GRID },
    tickLine: { stroke: SLATE_GRID },
  };
}

export function DailyBarChart({
  data,
  metric,
  stacked,
}: {
  data: DailyBucket[];
  metric: "count" | "value";
  stacked: boolean;
}) {
  const isCount = metric === "count";
  const Tooltip_ = isCount ? CountTooltip : ValueTooltip;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDateShort(d)}
          interval="preserveStartEnd"
          {...chartAxisProps()}
        />
        <YAxis
          tickFormatter={(v) => (isCount ? formatCount(v) : formatValueShort(v, false))}
          width={50}
          {...chartAxisProps()}
        />
        <Tooltip cursor={{ fill: "rgba(33, 9, 196, 0.04)" }} content={<Tooltip_ />} />
        {stacked ? (
          <>
            <Legend
              wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "#374151" }}
              iconType="circle"
              iconSize={8}
              align="right"
              verticalAlign="top"
            />
            <Bar
              dataKey={isCount ? "approvedCount" : "approvedValue"}
              name="Approved"
              stackId="a"
              fill={GREEN}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey={isCount ? "pendingCount" : "pendingValue"}
              name="Pending"
              stackId="a"
              fill={AMBER}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey={isCount ? "rejectedCount" : "rejectedValue"}
              name="Rejected"
              stackId="a"
              fill={TERRACOTTA}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey={isCount ? "canceledCount" : "canceledValue"}
              name="Canceled"
              stackId="a"
              fill={GRAY}
              radius={[4, 4, 0, 0]}
            />
          </>
        ) : (
          <Bar
            dataKey={isCount ? "count" : "value"}
            name={isCount ? "EOIs" : "Value"}
            fill={isCount ? BLUE : TERRACOTTA}
            radius={[4, 4, 0, 0]}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDoughnut({
  approved,
  pending,
  rejected,
  canceled,
}: {
  approved: number;
  pending: number;
  rejected: number;
  canceled: number;
}) {
  const total = approved + pending + rejected + canceled;
  const data = [
    { name: "Approved", value: approved, color: GREEN },
    { name: "Pending", value: pending, color: AMBER },
    { name: "Rejected", value: rejected, color: TERRACOTTA },
    { name: "Canceled", value: canceled, color: GRAY },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip
          content={(props: TipProps) => {
            const { active, payload } = props;
            if (!active || !payload?.length) return null;
            const p = payload[0];
            const v = Number(p.value);
            const pct = total === 0 ? 0 : ((v / total) * 100).toFixed(1);
            const slice = p.payload as { name: string; color: string };
            return (
              <div style={tooltipStyle}>
                <div className="text-[12px] text-slate-700">
                  <span style={{ color: slice.color }}>● {slice.name}</span>
                </div>
                <div className="text-[12px] tabular-nums text-charcoal font-semibold">
                  {formatCount(v)} ({pct}%)
                </div>
              </div>
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BulkBucketsChart({
  data,
  metric,
}: {
  data: Array<{ bucket: string; groups: number; units: number; value: number }>;
  metric: "groups" | "value";
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <XAxis dataKey="bucket" {...chartAxisProps()} />
        <YAxis
          tickFormatter={(v) => (metric === "groups" ? formatCount(v) : formatValueShort(v, false))}
          width={50}
          {...chartAxisProps()}
        />
        <Tooltip
          cursor={{ fill: "rgba(33, 9, 196, 0.04)" }}
          content={(props: TipProps) => {
            const { active, payload, label } = props;
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as {
              bucket: string;
              groups: number;
              units: number;
              value: number;
            };
            return (
              <div style={tooltipStyle}>
                <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">
                  {tipLabel(label)} units per bulk
                </div>
                <div className="text-[12px] flex justify-between gap-4">
                  <span className="text-slate-500">Groups</span>
                  <span className="tabular-nums font-semibold">{formatCount(row.groups)}</span>
                </div>
                <div className="text-[12px] flex justify-between gap-4">
                  <span className="text-slate-500">Units</span>
                  <span className="tabular-nums font-semibold">{formatCount(row.units)}</span>
                </div>
                <div className="text-[12px] flex justify-between gap-4">
                  <span className="text-slate-500">Value</span>
                  <span className="tabular-nums font-semibold">{formatValueShort(row.value)}</span>
                </div>
              </div>
            );
          }}
        />
        <Bar
          dataKey={metric}
          name={metric === "groups" ? "Bulk groups" : "Total value"}
          fill={metric === "groups" ? BLUE : TERRACOTTA}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BrokersBarChart({
  data,
}: {
  data: Array<{ name: string; count: number; value: number; isOther?: boolean }>;
}) {
  // Horizontal bar, sorted descending (data already sorted, "Other" pinned last).
  const height = Math.max(180, data.length * 28 + 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 20, bottom: 4, left: 20 }}>
        <XAxis type="number" tickFormatter={(v) => formatCount(v)} {...chartAxisProps()} />
        <YAxis
          type="category"
          dataKey="name"
          width={170}
          tick={{ fill: "#374151", fontSize: 10, fontFamily: "var(--font-sans)" }}
          axisLine={{ stroke: SLATE_GRID }}
          tickLine={{ stroke: SLATE_GRID }}
        />
        <Tooltip
          cursor={{ fill: "rgba(33, 9, 196, 0.04)" }}
          content={(props: TipProps) => {
            const { active, payload } = props;
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { name: string; count: number; value: number };
            return (
              <div style={tooltipStyle}>
                <div className="text-[12px] text-charcoal font-semibold">{row.name}</div>
                <div className="text-[12px] flex justify-between gap-4">
                  <span className="text-slate-500">EOIs</span>
                  <span className="tabular-nums font-semibold">{formatCount(row.count)}</span>
                </div>
                <div className="text-[12px] flex justify-between gap-4">
                  <span className="text-slate-500">Value</span>
                  <span className="tabular-nums font-semibold">{formatValueShort(row.value)}</span>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="count" name="EOIs" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isOther ? GRAY : BLUE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TypeCompositionBar({
  residentialCount,
  adminCount,
  residentialValue,
  adminValue,
}: {
  residentialCount: number;
  adminCount: number;
  residentialValue: number;
  adminValue: number;
}) {
  const tCount = residentialCount + adminCount || 1;
  const tValue = residentialValue + adminValue || 1;
  const data = [
    {
      label: "By count",
      Residential: (residentialCount / tCount) * 100,
      Admin: (adminCount / tCount) * 100,
    },
    {
      label: "By value",
      Residential: (residentialValue / tValue) * 100,
      Admin: (adminValue / tValue) * 100,
    },
  ];
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 10, bottom: 0, left: 60 }}>
        <XAxis type="number" hide domain={[0, 100]} />
        <YAxis
          type="category"
          dataKey="label"
          {...chartAxisProps()}
          width={60}
        />
        <Tooltip
          content={(props: TipProps) => {
            const { active, payload, label } = props;
            if (!active || !payload?.length || label === undefined || label === "") return null;
            return (
              <div style={tooltipStyle}>
                <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">
                  {tipLabel(label)}
                </div>
                {payload.map((p) => (
                  <div key={String(p.dataKey)} className="flex justify-between gap-4 text-[12px]">
                    <span style={{ color: p.color }}>● {tipName(p)}</span>
                    <span className="tabular-nums font-semibold">
                      {tipNum(p).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          iconType="circle"
          iconSize={8}
          align="right"
          verticalAlign="top"
        />
        <Bar dataKey="Residential" stackId="t" fill={BLUE} radius={[4, 0, 0, 4]} />
        <Bar dataKey="Admin" stackId="t" fill={TERRACOTTA} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
