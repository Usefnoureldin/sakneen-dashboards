import Link from "next/link";
import { auth } from "@/auth";
import { listSakneenAdmins } from "@/lib/queries";
import { formatTimestamp } from "@/lib/format";
import { deactivateAdminAction, reactivateAdminAction } from "./actions";

export default async function AdminUsersPage() {
  const session = await auth();
  const admins = await listSakneenAdmins();

  return (
    <main className="max-w-5xl mx-auto px-6 pt-10 pb-16">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
        Sakneen Admins
      </p>
      <div className="flex items-baseline justify-between gap-4 mb-6">
        <h1 className="font-serif text-3xl text-charcoal">Admin users</h1>
        <Link
          href="/admin/users/new"
          className="text-sm px-4 py-2 rounded-md bg-sakneen-blue text-white hover:opacity-90"
        >
          Invite admin
        </Link>
      </div>
      <p className="text-sm text-slate-600 mb-8">
        Sakneen admins can upload daily exports, publish reports, and manage users for any client.
      </p>

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
            {admins.map((u) => {
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
                      <form action={deactivateAdminAction} className="inline">
                        <input type="hidden" name="userId" value={u.id} />
                        <button
                          type="submit"
                          className="text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-pill-rejected-fg"
                        >
                          Deactivate
                        </button>
                      </form>
                    ) : (
                      <form action={reactivateAdminAction} className="inline">
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
