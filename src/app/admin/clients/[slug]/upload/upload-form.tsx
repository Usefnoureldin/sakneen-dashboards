"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";

type Props = { slug: string };

export function UploadForm({ slug }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [legacy, setLegacy] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setError(null);
    setFile(accepted[0] ?? null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    multiple: false,
  });

  async function onSubmit() {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (legacy) fd.append("legacy", "true");
      const res = await fetch(`/api/admin/clients/${slug}/uploads`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Upload failed.");
        setSubmitting(false);
        return;
      }
      router.push(`/admin/clients/${slug}/upload/${body.uploadId}/preview`);
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()}
        className={`rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-sakneen-blue bg-sakneen-blue/5"
            : "border-slate-300 bg-warm-cream hover:bg-white"
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1">
              Ready to upload
            </p>
            <p className="font-serif text-xl text-charcoal">{file.name}</p>
            <p className="text-sm text-slate-600 mt-1">
              {(file.size / 1024).toFixed(1)} KB · click to choose a different file
            </p>
          </div>
        ) : (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500 mb-1">
              Excel upload
            </p>
            <p className="font-serif text-xl text-charcoal">
              {isDragActive ? "Drop the file here" : "Drop the Excel file here"}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              or click to browse. Accepts .xlsx and .xls, up to 10 MB.
            </p>
          </div>
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-terracotta/30 bg-pill-rejected-bg px-3 py-2 text-sm text-pill-rejected-fg"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={legacy}
            onChange={(e) => setLegacy(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sakneen-blue focus:ring-sakneen-blue"
          />
          <span>
            Treat as legacy format (auto-convert)
            <span className="block text-xs text-slate-500">
              Use this for exports that still have Excel-typed dates and blank rows. Removed once
              the standardized export is rolled out.
            </span>
          </span>
        </label>
        <button
          type="button"
          disabled={!file || submitting}
          onClick={onSubmit}
          className="rounded-md bg-sakneen-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 shrink-0"
        >
          {submitting ? "Parsing..." : "Upload"}
        </button>
      </div>
    </div>
  );
}
