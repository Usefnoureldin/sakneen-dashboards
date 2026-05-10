"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { formatDateShort } from "@/lib/format";

type Props = {
  start: string | null; // YYYY-MM-DD
  end: string | null;
  /** Inclusive bounds the user can select within (the data range). */
  min: string;
  max: string;
  onChange: (range: { start: string | null; end: string | null }) => void;
};

function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function fromISO(s: string | null): Date | undefined {
  return s ? new Date(`${s}T00:00:00Z`) : undefined;
}

/** Generate up to N most-recent months that intersect [min..max]. */
function recentMonths(min: string, max: string, n: number) {
  const out: { label: string; start: string; end: string }[] = [];
  const minD = new Date(`${min}T00:00:00Z`);
  const maxD = new Date(`${max}T00:00:00Z`);
  // Walk backward from max month-by-month.
  const cursor = new Date(Date.UTC(maxD.getUTCFullYear(), maxD.getUTCMonth(), 1));
  while (out.length < n && cursor >= new Date(Date.UTC(minD.getUTCFullYear(), minD.getUTCMonth(), 1))) {
    const monthStart = new Date(cursor);
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const clampedStart = monthStart < minD ? minD : monthStart;
    const clampedEnd = monthEnd > maxD ? maxD : monthEnd;
    out.push({
      label: `${monthStart.toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${monthStart.getUTCFullYear()}`,
      start: isoDate(clampedStart),
      end: isoDate(clampedEnd),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return out;
}

export function DateRangePicker({ start, end, min, max, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Track viewport width so we can show 1 month on mobile, 2 on desktop.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const months = useMemo(() => recentMonths(min, max, 6), [min, max]);
  const minDate = fromISO(min)!;
  const maxDate = fromISO(max)!;

  // Close on outside click + Esc.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const range: DateRange | undefined =
    start || end ? { from: fromISO(start), to: fromISO(end) } : undefined;
  const buttonLabel =
    start && end
      ? `${formatDateShort(start)} - ${formatDateShort(end)}`
      : start
        ? `${formatDateShort(start)} -`
        : "Pick a date range";

  function pickMonth(s: string, e: string) {
    onChange({ start: s, end: e });
  }

  function handleSelect(r: DateRange | undefined) {
    if (!r) {
      onChange({ start: null, end: null });
      return;
    }
    const s = r.from ? isoDate(r.from) : null;
    const e = r.to ? isoDate(r.to) : null;
    onChange({ start: s, end: e });
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border transition ${
          open
            ? "bg-sakneen-blue text-white border-sakneen-blue"
            : "bg-white text-charcoal border-slate-200 hover:border-slate-300"
        }`}
      >
        <CalendarIcon className="w-3.5 h-3.5" />
        <span className="font-mono tracking-tight">{buttonLabel}</span>
      </button>

      {open ? (
        <div
          className={`z-40 rounded-xl border border-slate-200 bg-white shadow-lg p-4 ${
            isDesktop
              ? "absolute left-0 top-full mt-2 min-w-[640px]"
              : "fixed inset-x-4 top-24 max-h-[calc(100vh-7rem)] overflow-y-auto"
          }`}
        >
          <div className="mb-3">
            <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 mb-2">
              Quick select month
            </p>
            <div className="flex flex-wrap gap-1.5">
              {months.map((m) => {
                const active = start === m.start && end === m.end;
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => pickMonth(m.start, m.end)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      active
                        ? "bg-sakneen-blue text-white border-sakneen-blue"
                        : "bg-white text-charcoal border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <DayPicker
            mode="range"
            numberOfMonths={isDesktop ? 2 : 1}
            selected={range}
            onSelect={handleSelect}
            disabled={{ before: minDate, after: maxDate }}
            defaultMonth={range?.from ?? maxDate}
            showOutsideDays
            classNames={{
              root: "drp",
              months: "flex gap-6",
              month: "space-y-2",
              month_caption: "flex items-center justify-center h-8",
              caption_label: "font-serif text-base text-charcoal",
              nav: "absolute top-0 left-0 right-0 flex items-center justify-between px-1",
              button_previous:
                "h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 text-charcoal hover:bg-slate-50 cursor-pointer",
              button_next:
                "h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 text-charcoal hover:bg-slate-50 cursor-pointer",
              chevron: "w-3 h-3 fill-current",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday:
                "w-9 h-8 inline-flex items-center justify-center font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500 font-normal",
              weeks: "",
              week: "flex w-full",
              day: "w-9 h-9 text-center align-middle p-0 text-sm",
              day_button:
                "w-full h-full inline-flex items-center justify-center rounded-md hover:bg-slate-100 cursor-pointer",
              today: "ring-1 ring-sakneen-blue/30 rounded-md",
              outside: "text-slate-300",
              disabled: "text-slate-300 cursor-default opacity-50",
              selected: "bg-sakneen-blue text-white",
              range_start:
                "rounded-l-md rounded-r-none bg-sakneen-blue text-white",
              range_end:
                "rounded-r-md rounded-l-none bg-sakneen-blue text-white",
              range_middle: "bg-sakneen-blue/15 text-charcoal rounded-none",
            }}
          />

          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {start && end
                ? `Selected: ${formatDateShort(start)} - ${formatDateShort(end)}`
                : "Click two dates to set a range"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ start: null, end: null })}
                className="text-xs px-3 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={!(start && end)}
                className="text-xs px-3 py-1 rounded-md bg-sakneen-blue text-white disabled:opacity-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
