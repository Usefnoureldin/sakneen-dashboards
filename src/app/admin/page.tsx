import Link from "next/link";
import { listClientsWithLatestPublished } from "@/lib/queries";
import { formatCount, formatDateRange, formatTimestamp } from "@/lib/format";

export default async function AdminHome() {
  const list = await listClientsWithLatestPublished();

  return (
    <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
        Clients
      </p>
      <h1 className="font-serif text-3xl text-charcoal mb-6">Active client dashboards</h1>

      <ul className="grid gap-4 sm:grid-cols-2">
        {list.map(({ client, lastPublished }) => (
          <li
            key={client.id}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-charcoal">{client.displayName}</h2>
                <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500 mt-0.5">
                  {client.slug}.sakneen.com
                </p>
              </div>
              <span
                className={`font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${
                  client.active
                    ? "bg-pill-approved-bg text-pill-approved-fg"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {client.active ? "Active" : "Inactive"}
              </span>
            </div>

            {lastPublished ? (
              <div className="text-sm text-slate-700 space-y-0.5">
                <p>
                  <span className="text-slate-500">Last published: </span>
                  {formatTimestamp(lastPublished.publishedAt)}
                </p>
                <p>
                  <span className="text-slate-500">Window: </span>
                  {formatDateRange(lastPublished.dateMin, lastPublished.dateMax)}
                </p>
                <p>
                  <span className="text-slate-500">EOIs: </span>
                  {formatCount(lastPublished.rowCount)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No published report yet.</p>
            )}

            <div className="mt-auto flex gap-2 pt-2">
              <Link
                href={`/admin/clients/${client.slug}`}
                className="text-xs px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-charcoal"
              >
                Open
              </Link>
              <Link
                href={`/admin/clients/${client.slug}/upload`}
                className="text-xs px-3 py-1.5 rounded-md bg-sakneen-blue text-white hover:opacity-90"
              >
                New upload
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
