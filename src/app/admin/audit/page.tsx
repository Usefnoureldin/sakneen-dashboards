import Link from "next/link";
import { listRecentAuditEntries } from "@/lib/queries";
import { formatTimestamp } from "@/lib/format";

const ACTION_PILL: Record<string, string> = {
  login: "bg-pill-approved-bg text-pill-approved-fg",
  login_failed: "bg-pill-rejected-bg text-pill-rejected-fg",
  upload_create: "bg-pill-pending-bg text-pill-pending-fg",
  upload_publish: "bg-pill-approved-bg text-pill-approved-fg",
  upload_discard: "bg-slate-100 text-slate-600",
  pdf_download: "bg-slate-100 text-slate-700",
  user_create: "bg-pill-approved-bg text-pill-approved-fg",
  user_deactivate: "bg-pill-rejected-bg text-pill-rejected-fg",
  user_reactivate: "bg-pill-approved-bg text-pill-approved-fg",
};

export default async function AuditPage() {
  const entries = await listRecentAuditEntries(100);

  return (
    <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
        Audit
      </p>
      <h1 className="font-serif text-3xl text-charcoal mb-1">Activity log</h1>
      <p className="text-sm text-slate-600 mb-8">
        Last {entries.length} entries across logins, uploads, publishes, downloads, and user
        management.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-warm-cream p-6 text-sm text-slate-600">
          No activity recorded yet.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <Th>When</Th>
                <Th>Action</Th>
                <Th>User</Th>
                <Th>Client</Th>
                <Th>Detail</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={String(e.id)} className="border-t border-slate-100 align-top">
                  <Td>
                    <span className="font-mono text-[11px] text-slate-700">
                      {formatTimestamp(e.createdAt)}
                    </span>
                  </Td>
                  <Td>
                    <span
                      className={`font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${
                        ACTION_PILL[e.action] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {e.action}
                    </span>
                  </Td>
                  <Td>
                    {e.user ? (
                      <div>
                        <p className="text-charcoal">{e.user.name}</p>
                        <p className="font-mono text-[10px] text-slate-500">{e.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {e.client ? (
                      <Link
                        href={`/admin/clients/${e.client.slug}`}
                        className="text-charcoal hover:underline"
                      >
                        {e.client.name}
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    {e.metadata ? (
                      <pre className="font-mono text-[10px] text-slate-700 whitespace-pre-wrap break-all max-w-md">
                        {JSON.stringify(e.metadata, null, 0)}
                      </pre>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="font-mono text-[10px] text-slate-500">
                      {e.ipAddress ?? "—"}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 font-mono text-[9px] uppercase tracking-[1.5px] text-left ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}
