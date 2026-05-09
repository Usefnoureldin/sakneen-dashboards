import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientBySlug, getUpload } from "@/lib/queries";
import {
  formatCount,
  formatDateRange,
  formatPercent,
  formatTimestamp,
  formatValueLong,
  formatValueShort,
} from "@/lib/format";
import { discardUploadAction, publishUploadAction } from "./actions";

export default async function UploadPreview({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();
  const upload = await getUpload(id, client.id);
  if (!upload) notFound();

  const isDraft = upload.status === "draft";
  const totalCount = upload.totalCount;
  const value = formatValueLong(upload.totalValueEgp);
  const warnings = (upload.parseWarnings as string[] | null) ?? [];

  return (
    <main className="max-w-4xl mx-auto px-6 pt-10 pb-32">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
        <Link href={`/admin/clients/${client.slug}`} className="hover:underline">
          {client.displayName}
        </Link>
        {" · Upload preview"}
      </p>
      <h1 className="font-serif text-3xl text-charcoal mb-1">Preview upload</h1>
      <p className="text-sm text-slate-600">
        Review the data, then publish to make it visible to {client.displayName}.
      </p>
      <p className="text-xs text-slate-500 mt-1 font-mono">
        Status: {upload.status} · Uploaded {formatTimestamp(upload.uploadedAt)} ·{" "}
        {upload.fileName}
      </p>

      {warnings.length > 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-100 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-700 mb-2">
            Parsing notes
          </p>
          <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-sakneen-blue text-white p-6">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-white/75 mb-1">
            Total EOIs Collected
          </p>
          <p className="font-serif text-5xl tracking-tight">{formatCount(totalCount)}</p>
          <p className="text-sm text-white/80 mt-1">expressions of interest</p>
        </div>
        <div className="rounded-xl bg-terracotta text-white p-6">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-white/75 mb-1">
            Total Value
          </p>
          <p className="font-serif text-5xl tracking-tight">
            {formatValueShort(upload.totalValueEgp, false)}
          </p>
          <p className="text-sm text-white/80 mt-1">{value}</p>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 grid sm:grid-cols-3 gap-4">
        <Stat label="Window" value={formatDateRange(upload.dateMin, upload.dateMax)} />
        <Stat label="Rows" value={formatCount(upload.rowCount)} />
        <Stat label="Total value (long)" value={value} />
      </section>

      <h2 className="font-serif text-xl text-charcoal mt-10 mb-3">Status breakdown</h2>
      <StatusBreakdown
        approved={await countByStatus(upload.id, "approved")}
        pending={await countByStatus(upload.id, "pending")}
        rejected={await countByStatus(upload.id, "rejected")}
        total={totalCount}
      />

      <h2 className="font-serif text-xl text-charcoal mt-10 mb-3">Type breakdown</h2>
      <TypeBreakdown
        residential={await countByType(upload.id, "Residential")}
        admin={await countByType(upload.id, "Admin")}
        total={totalCount}
      />

      {isDraft ? (
        <ActionBar slug={client.slug} uploadId={upload.id} clientName={client.displayName} />
      ) : (
        <p className="mt-12 text-sm text-slate-500">
          This upload is in {upload.status} state and cannot be modified.
        </p>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">{label}</p>
      <p className="font-sans font-semibold text-charcoal mt-0.5">{value}</p>
    </div>
  );
}

async function countByStatus(uploadId: string, status: "approved" | "pending" | "rejected") {
  const { db } = await import("@/db");
  const { eoiRecords } = await import("@/db/schema");
  const { sql, and, eq } = await import("drizzle-orm");
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(eoiRecords)
    .where(and(eq(eoiRecords.uploadId, uploadId), eq(eoiRecords.status, status)));
  return c;
}

async function countByType(uploadId: string, type: "Residential" | "Admin") {
  const { db } = await import("@/db");
  const { eoiRecords } = await import("@/db/schema");
  const { sql, and, eq } = await import("drizzle-orm");
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(eoiRecords)
    .where(and(eq(eoiRecords.uploadId, uploadId), eq(eoiRecords.unitType, type)));
  return c;
}

function StatusBreakdown(props: {
  approved: number;
  pending: number;
  rejected: number;
  total: number;
}) {
  const cards: Array<{
    label: string;
    n: number;
    border: string;
    pillBg: string;
    pillFg: string;
    accent: string;
  }> = [
    {
      label: "Approved",
      n: props.approved,
      border: "border-status-approved",
      pillBg: "bg-pill-approved-bg",
      pillFg: "text-pill-approved-fg",
      accent: "bg-status-approved",
    },
    {
      label: "Pending",
      n: props.pending,
      border: "border-status-pending",
      pillBg: "bg-pill-pending-bg",
      pillFg: "text-pill-pending-fg",
      accent: "bg-status-pending",
    },
    {
      label: "Rejected",
      n: props.rejected,
      border: "border-status-rejected",
      pillBg: "bg-pill-rejected-bg",
      pillFg: "text-pill-rejected-fg",
      accent: "bg-status-rejected",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className={`h-1 ${c.accent}`} />
          <div className="p-4">
            <span
              className={`inline-block font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${c.pillBg} ${c.pillFg}`}
            >
              ● {c.label}
            </span>
            <p className="font-serif text-3xl text-charcoal mt-3">
              {formatPercent(c.n, props.total)}
            </p>
            <p className="text-sm text-slate-600 mt-1">{formatCount(c.n)} EOIs</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TypeBreakdown(props: { residential: number; admin: number; total: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl bg-warm-cream p-5">
        <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-terracotta mb-1">
          Residential
        </p>
        <p className="font-serif text-4xl text-charcoal">
          {formatPercent(props.residential, props.total)}
        </p>
        <p className="text-sm text-slate-700 mt-1">{formatCount(props.residential)} EOIs</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500 mb-1">
          Admin
        </p>
        <p className="font-serif text-4xl text-charcoal">
          {formatPercent(props.admin, props.total)}
        </p>
        <p className="text-sm text-slate-700 mt-1">{formatCount(props.admin)} EOIs</p>
      </div>
    </div>
  );
}

function ActionBar({
  slug,
  uploadId,
  clientName,
}: {
  slug: string;
  uploadId: string;
  clientName: string;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/90 backdrop-blur">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        <p className="text-xs text-slate-600 hidden sm:block">
          Publishing replaces the currently published report for {clientName}.
        </p>
        <div className="flex gap-2">
          <form action={discardUploadAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="uploadId" value={uploadId} />
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              Discard
            </button>
          </form>
          <form action={publishUploadAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="uploadId" value={uploadId} />
            <button
              type="submit"
              className="rounded-md bg-sakneen-blue px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Publish to {clientName}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
