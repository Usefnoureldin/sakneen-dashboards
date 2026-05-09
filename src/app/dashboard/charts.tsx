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
}: {
  approved: number;
  pending: number;
  rejected: number;
}) {
  const total = approved + pending + rejected;
  const data = [
    { name: "Approved", value: approved, color: GREEN },
    { name: "Pending", value: pending, color: AMBER },
    { name: "Rejected", value: rejected, color: TERRACOTTA },
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
  const data = [
    {
      label: "By count",
      Residential: residentialCount,
      Admin: adminCount,
    },
    {
      label: "By value",
      Residential: residentialValue,
      Admin: adminValue,
    },
  ];
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart layout="vertical" data={data} margin={{ top: 0, right: 10, bottom: 0, left: 60 }}>
        <XAxis type="number" hide />
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
            const isCount = tipLabel(label) === "By count";
            const total = payload.reduce((s, p) => s + tipNum(p), 0);
            return (
              <div style={tooltipStyle}>
                <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">
                  {tipLabel(label)}
                </div>
                {payload.map((p) => {
                  const n = tipNum(p);
                  const pct = total === 0 ? 0 : ((n / total) * 100).toFixed(1);
                  const v = isCount ? formatCount(n) : formatValueShort(n);
                  return (
                    <div key={String(p.dataKey)} className="flex justify-between gap-4 text-[12px]">
                      <span style={{ color: p.color }}>● {tipName(p)}</span>
                      <span className="tabular-nums font-semibold">
                        {v} ({pct}%)
                      </span>
                    </div>
                  );
                })}
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
