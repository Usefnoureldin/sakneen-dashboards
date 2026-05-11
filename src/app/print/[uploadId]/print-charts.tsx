"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyBucket } from "@/lib/aggregations";
import { formatCount, formatDateShort, formatValueShort } from "@/lib/format";

const BLUE = "#2109C4";
const ACCENT_BLUE = "#4A6CF7";
const REJECTED_RED = "#C84B31";
const GREEN = "#4FB54E";
const AMBER = "#F59E0B";
const GRAY = "#6B7280";
const SLATE_GRID = "#DDE2EB";

const axisProps = {
  tick: { fill: "#374151", fontSize: 9, fontFamily: "var(--font-sans)" },
  axisLine: { stroke: SLATE_GRID },
  tickLine: { stroke: SLATE_GRID },
};

export function PrintDailyChart({
  data,
  metric,
  stacked,
  height = 200,
}: {
  data: DailyBucket[];
  metric: "count" | "value";
  stacked: boolean;
  height?: number;
}) {
  const isCount = metric === "count";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 16, left: 0, bottom: 18 }}>
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDateShort(d)}
          interval={0}
          angle={-45}
          textAnchor="end"
          height={36}
          tickMargin={4}
          {...axisProps}
        />
        <YAxis
          tickFormatter={(v) => (isCount ? formatCount(v) : formatValueShort(v, false))}
          width={48}
          {...axisProps}
        />
        {stacked ? (
          <>
            <Legend
              wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
              iconType="circle"
              iconSize={7}
              align="right"
              verticalAlign="top"
            />
            <Bar
              dataKey={isCount ? "approvedCount" : "approvedValue"}
              name="Approved"
              stackId="a"
              fill={GREEN}
              isAnimationActive={false}
            />
            <Bar
              dataKey={isCount ? "pendingCount" : "pendingValue"}
              name="Pending"
              stackId="a"
              fill={AMBER}
              isAnimationActive={false}
            />
            <Bar
              dataKey={isCount ? "rejectedCount" : "rejectedValue"}
              name="Rejected"
              stackId="a"
              fill={REJECTED_RED}
              isAnimationActive={false}
            />
            <Bar
              dataKey={isCount ? "canceledCount" : "canceledValue"}
              name="Canceled"
              stackId="a"
              fill={GRAY}
              isAnimationActive={false}
            />
          </>
        ) : (
          <Bar
            dataKey={isCount ? "count" : "value"}
            fill={isCount ? BLUE : REJECTED_RED}
            isAnimationActive={false}
          >
            {isCount ? (
              <LabelList
                dataKey="count"
                position="top"
                fill="#374151"
                fontSize={8}
                fontFamily="var(--font-sans)"
                formatter={(v) => {
                  const n = Number(v);
                  return n > 0 ? String(n) : "";
                }}
              />
            ) : null}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PrintStatusDoughnut({
  approved,
  pending,
  rejected,
  canceled,
  height = 180,
}: {
  approved: number;
  pending: number;
  rejected: number;
  canceled: number;
  height?: number;
}) {
  const data = [
    { name: "Approved", value: approved, color: GREEN },
    { name: "Pending", value: pending, color: AMBER },
    { name: "Rejected", value: rejected, color: REJECTED_RED },
    { name: "Canceled", value: canceled, color: GRAY },
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={45}
          outerRadius={75}
          paddingAngle={2}
          stroke="none"
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Legend
          wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
          iconType="circle"
          iconSize={7}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PrintTypeBar({
  residentialCount,
  adminCount,
  residentialValue,
  adminValue,
  height = 120,
}: {
  residentialCount: number;
  adminCount: number;
  residentialValue: number;
  adminValue: number;
  height?: number;
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
  const pctLabel = (v: unknown) => {
    const n = Number(v);
    return n >= 4 ? `${n.toFixed(1)}%` : "";
  };
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 32, bottom: 18, left: 56 }}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          {...axisProps}
        />
        <YAxis type="category" dataKey="label" width={56} {...axisProps} />
        <Legend
          wrapperStyle={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
          iconType="circle"
          iconSize={7}
          align="right"
          verticalAlign="top"
        />
        <Bar dataKey="Residential" stackId="t" fill={BLUE} isAnimationActive={false}>
          <LabelList
            dataKey="Residential"
            position="center"
            formatter={pctLabel}
            fill="#FFFFFF"
            fontSize={11}
            fontWeight={600}
            fontFamily="var(--font-sans)"
          />
        </Bar>
        <Bar dataKey="Admin" stackId="t" fill={REJECTED_RED} isAnimationActive={false}>
          <LabelList
            dataKey="Admin"
            position="center"
            formatter={pctLabel}
            fill="#FFFFFF"
            fontSize={11}
            fontWeight={600}
            fontFamily="var(--font-sans)"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PrintBulkChart({
  data,
  metric,
  height = 200,
}: {
  data: Array<{ bucket: string; groups: number; units: number; value: number }>;
  metric: "groups" | "value";
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis width={48} {...axisProps} />
        <Bar
          dataKey={metric}
          fill={metric === "groups" ? BLUE : ACCENT_BLUE}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PrintBrokersChart({
  data,
}: {
  data: Array<{ name: string; count: number; isOther?: boolean }>;
}) {
  const height = Math.max(180, data.length * 24 + 30);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, bottom: 4, left: 12 }}>
        <XAxis type="number" {...axisProps} />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fill: "#374151", fontSize: 9, fontFamily: "var(--font-sans)" }}
          axisLine={{ stroke: SLATE_GRID }}
          tickLine={{ stroke: SLATE_GRID }}
        />
        <Bar dataKey="count" isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isOther ? GRAY : BLUE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Marker the PDF route waits on before screenshotting. Mounts after the React tree commits,
 * which happens after Recharts has rendered its SVG.
 */
export function PrintReadyMarker() {
  return <div id="print-ready" data-ready="1" style={{ display: "none" }} />;
}
