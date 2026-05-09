"use client";

import { useState } from "react";

export function DownloadPdfButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/dashboard/pdf", { method: "GET" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || `Failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m ? m[1] : "EOI_Report.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(`Network error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-md bg-sakneen-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Generating PDF..." : "Download PDF"}
      </button>
      {err ? <span className="text-xs text-pill-rejected-fg">{err}</span> : null}
    </div>
  );
}
