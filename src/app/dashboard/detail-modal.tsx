"use client";

import { useEffect, useState } from "react";
import type { DashboardData } from "@/lib/aggregations";
import {
  formatCount,
  formatDateLong,
  formatDateShort,
  formatPercent,
  formatValueShort,
} from "@/lib/format";

export type DetailKey = "approved" | "pending" | "rejected" | "Residential" | "Admin" | null;

const STATUS_TONE: Record<
  string,
  { accent: string; pillBg: string; pillFg: string; label: string }
> = {
  approved: {
    accent: "bg-status-approved",
    pillBg: "bg-pill-approved-bg",
    pillFg: "text-pill-approved-fg",
    label: "Approved",
  },
  pending: {
    accent: "bg-status-pending",
    pillBg: "bg-pill-pending-bg",
    pillFg: "text-pill-pending-fg",
    label: "Pending",
  },
  rejected: {
    accent: "bg-status-rejected",
    pillBg: "bg-pill-rejected-bg",
    pillFg: "text-pill-rejected-fg",
    label: "Rejected",
  },
};

export function DetailModal({
  open,
  onClose,
  data,
}: {
  open: DetailKey;
  onClose: () => void;
  data: DashboardData;
}) {
  // Two-step state so we can animate exit before unmount.
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, onClose]);

  if (!mounted || !open) return null;

  const isStatus = open === "approved" || open === "pending" || open === "rejected";
  const isType = open === "Residential" || open === "Admin";

  // Build per-day rows filtered to the chosen slice.
  const rows = data.daily
    .map((d) => {
      let count = 0;
      let value = 0;
      if (isStatus) {
        count =
          open === "approved"
            ? d.approvedCount
            : open === "pending"
              ? d.pendingCount
              : d.rejectedCount;
        value =
          open === "approved"
            ? d.approvedValue
            : open === "pending"
              ? d.pendingValue
              : d.rejectedValue;
      } else if (isType) {
        // Type isn't pre-aggregated daily — derive from records.
        const recs = data.records.filter((r) => r.eoiDate === d.date && r.unitType === open);
        count = recs.length;
        value = recs.reduce((s, r) => s + r.amountEgp, 0);
      }
      return { date: d.date, count, value };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const peakCount = Math.max(1, ...rows.map((r) => r.count));

  const tone = isStatus
    ? STATUS_TONE[open]
    : {
        accent: open === "Residential" ? "bg-sakneen-blue" : "bg-terracotta",
        pillBg: open === "Residential" ? "bg-warm-cream" : "bg-slate-100",
        pillFg: "text-charcoal",
        label: open as string,
      };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${tone.label} breakdown`}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-200 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"
        }`}
      >
        <div className={`h-1 ${tone.accent}`} />
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <span
              className={`inline-block font-mono text-[10px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${tone.pillBg} ${tone.pillFg}`}
            >
              ● {tone.label}
            </span>
            <h2 className="font-serif text-2xl text-charcoal mt-2">
              {tone.label} breakdown
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              {formatCount(totalCount)} EOIs · {formatValueShort(totalValue)} ·{" "}
              {data.totals.totalCount > 0
                ? formatPercent(totalCount, data.totals.totalCount)
                : "0%"}{" "}
              of total
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 shrink-0"
          >
            Esc · Close
          </button>
        </div>

        <div className="px-6 pt-4 pb-6 overflow-y-auto" style={{ maxHeight: "calc(85vh - 80px)" }}>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No EOIs in this slice for the current filters.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-slate-500">
                <tr>
                  <Th>Date</Th>
                  <Th className="text-right">Count</Th>
                  <Th className="text-right">Value</Th>
                  <Th className="text-right">Share</Th>
                  <Th>Distribution</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const widthPct = (r.count / peakCount) * 100;
                  return (
                    <tr key={r.date} className="border-t border-slate-100">
                      <Td>
                        <span className="font-sans">{formatDateLong(r.date)}</span>
                        <span className="ml-2 font-mono text-[10px] text-slate-400">
                          {formatDateShort(r.date)}
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums font-semibold">
                        {formatCount(r.count)}
                      </Td>
                      <Td className="text-right tabular-nums">{formatValueShort(r.value)}</Td>
                      <Td className="text-right tabular-nums text-slate-600">
                        {formatPercent(r.count, totalCount)}
                      </Td>
                      <Td>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${tone.accent} rounded-full transition-all duration-500`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                <tr className="border-t border-slate-200 bg-slate-50">
                  <Td className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate-700">
                    Total
                  </Td>
                  <Td className="text-right tabular-nums font-semibold">
                    {formatCount(totalCount)}
                  </Td>
                  <Td className="text-right tabular-nums font-semibold">
                    {formatValueShort(totalValue)}
                  </Td>
                  <Td className="text-right tabular-nums text-slate-600">100.0%</Td>
                  <Td />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-mono text-[9px] uppercase tracking-[1.5px] text-left ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
