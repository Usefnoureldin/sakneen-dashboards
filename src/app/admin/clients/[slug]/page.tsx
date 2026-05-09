import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  getClientBySlug,
  listClientUsers,
  listUploadsForClient,
} from "@/lib/queries";
import {
  formatCount,
  formatDateRange,
  formatTimestamp,
  formatValueShort,
} from "@/lib/format";
import {
  deactivateClientUserAction,
  reactivateClientUserAction,
} from "./users/actions";

const STATUS_PILL: Record<string, string> = {
  draft: "bg-pill-pending-bg text-pill-pending-fg",
  published: "bg-pill-approved-bg text-pill-approved-fg",
  superseded: "bg-slate-100 text-slate-600",
  discarded: "bg-pill-rejected-bg text-pill-rejected-fg",
};

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const session = await auth();
  const uploads = await listUploadsForClient(client.id);
  const published = uploads.find((u) => u.status === "published") ?? null;
  const clientUsers = await listClientUsers(client.id);

  return (
    <main className="max-w-6xl mx-auto px-6 pt-10 pb-16">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
        Clients · {client.displayName}
      </p>
      <div className="flex items-baseline justify-between gap-4 mb-1">
        <h1 className="font-serif text-3xl text-charcoal">{client.displayName}</h1>
        <Link
          href={`/admin/clients/${client.slug}/upload`}
          className="text-sm px-4 py-2 rounded-md bg-sakneen-blue text-white hover:opacity-90"
        >
          New upload
        </Link>
      </div>
      <p className="text-sm text-slate-600">
        {client.slug}.sakneen.com
        {published
          ? ` · last published ${formatTimestamp(published.publishedAt)}`
          : " · no published report yet"}
      </p>

      <section className="mt-10">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500 mb-2">
          Current published
        </p>
        {published ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5 grid sm:grid-cols-4 gap-4">
            <Stat label="Window" value={formatDateRange(published.dateMin, published.dateMax)} />
            <Stat label="EOIs" value={formatCount(published.rowCount)} />
            <Stat label="Total value" value={formatValueShort(published.totalValueEgp)} />
            <Stat label="Published" value={formatTimestamp(published.publishedAt)} />
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-warm-cream p-6 text-sm text-slate-600">
            No published report. Use New upload to publish the first one.
          </div>
        )}
      </section>

      <section className="mt-10">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500 mb-2">
          Upload history
        </p>
        {uploads.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-warm-cream p-6 text-sm text-slate-600">
            No uploads yet.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>Uploaded</Th>
                  <Th>File</Th>
                  <Th>Window</Th>
                  <Th className="text-right">EOIs</Th>
                  <Th className="text-right">Value</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <Td>{formatTimestamp(u.uploadedAt)}</Td>
                    <Td>
                      <span className="font-mono text-xs text-slate-700">{u.fileName}</span>
                    </Td>
                    <Td className="text-slate-700">
                      {formatDateRange(u.dateMin, u.dateMax)}
                    </Td>
                    <Td className="text-right tabular-nums">{formatCount(u.rowCount)}</Td>
                    <Td className="text-right tabular-nums">{formatValueShort(u.totalValueEgp)}</Td>
                    <Td>
                      <span
                        className={`font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${
                          STATUS_PILL[u.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.status}
                      </span>
                    </Td>
                    <Td className="text-right">
                      {u.status === "draft" ? (
                        <Link
                          href={`/admin/clients/${client.slug}/upload/${u.id}/preview`}
                          className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50"
                        >
                          Review
                        </Link>
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500">
            Client users ({clientUsers.length})
          </p>
          <Link
            href={`/admin/clients/${client.slug}/users/new`}
            className="text-xs px-3 py-1.5 rounded-md bg-charcoal text-white hover:opacity-90"
          >
            Invite user
          </Link>
        </div>
        {clientUsers.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-warm-cream p-6 text-sm text-slate-600">
            No users yet. Invite the first one.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Last login</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {clientUsers.map((u) => {
                  const isSelf = u.id === session?.user?.id;
                  return (
                    <tr key={u.id} className="border-t border-slate-100">
                      <Td>{u.name}</Td>
                      <Td>
                        <span className="font-mono text-xs text-slate-700">{u.email}</span>
                      </Td>
                      <Td className="text-slate-700">
                        {u.lastLoginAt ? formatTimestamp(u.lastLoginAt) : "never"}
                      </Td>
                      <Td>
                        <span
                          className={`font-mono text-[9px] uppercase tracking-[1.5px] px-2 py-0.5 rounded ${
                            u.active
                              ? "bg-pill-approved-bg text-pill-approved-fg"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </Td>
                      <Td className="text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-400">(you)</span>
                        ) : u.active ? (
                          <form action={deactivateClientUserAction} className="inline">
                            <input type="hidden" name="slug" value={client.slug} />
                            <input type="hidden" name="userId" value={u.id} />
                            <button
                              type="submit"
                              className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-pill-rejected-fg"
                            >
                              Deactivate
                            </button>
                          </form>
                        ) : (
                          <form action={reactivateClientUserAction} className="inline">
                            <input type="hidden" name="slug" value={client.slug} />
                            <input type="hidden" name="userId" value={u.id} />
                            <button
                              type="submit"
                              className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-pill-approved-fg"
                            >
                              Reactivate
                            </button>
                          </form>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-4 py-2 font-mono text-[9px] uppercase tracking-[1.5px] text-left ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate-500">{label}</p>
      <p className="font-sans font-semibold text-charcoal mt-0.5">{value}</p>
    </div>
  );
}
