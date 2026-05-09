import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { clients } from "@/db/schema";

export default async function DashboardHome() {
  const session = await auth();
  const hdrs = await headers();
  const subdomainSlug = hdrs.get("x-tenant-slug");

  const userClientId = session?.user?.clientId ?? null;

  let client = null;
  if (userClientId) {
    [client] = await db.select().from(clients).where(eq(clients.id, userClientId)).limit(1);
  }

  // Cross-tenant URL guard: if the user is on someone else's subdomain, kick them home.
  const wrongTenant =
    subdomainSlug !== null && client !== null && subdomainSlug !== client.slug;

  return (
    <main className="min-h-screen bg-warm-cream p-8">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
          Daily EOI Tracker
        </p>
        <h1 className="font-serif text-3xl text-charcoal mb-2">
          {client?.displayName ?? "Dashboard"}
        </h1>
        <p className="text-sm text-slate-600 mb-2">
          Signed in as {session?.user?.email}.
        </p>
        <p className="text-sm text-slate-600 mb-8">
          Subdomain slug: <code className="font-mono">{subdomainSlug ?? "(none)"}</code>
          {" · "}Your client slug: <code className="font-mono">{client?.slug ?? "(none)"}</code>
          {wrongTenant ? (
            <span className="ml-2 rounded bg-pill-rejected-bg px-2 py-0.5 text-pill-rejected-fg">
              wrong tenant URL
            </span>
          ) : null}
        </p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-charcoal hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
