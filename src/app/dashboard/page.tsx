import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { clients, eoiUploads } from "@/db/schema";

export default async function DashboardHome() {
  const session = await auth();
  const hdrs = await headers();
  const subdomainSlug = hdrs.get("x-tenant-slug");

  const userClientId = session?.user?.clientId ?? null;

  let client = null;
  if (userClientId) {
    [client] = await db.select().from(clients).where(eq(clients.id, userClientId)).limit(1);
  }

  const wrongTenant = subdomainSlug !== null && client !== null && subdomainSlug !== client.slug;

  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Cairo",
  }).format(new Date());

  const [latestPublished] = userClientId
    ? await db
        .select({ publishedAt: eoiUploads.publishedAt })
        .from(eoiUploads)
        .where(and(eq(eoiUploads.clientId, userClientId), eq(eoiUploads.status, "published")))
        .limit(1)
    : [];

  return (
    <main className="min-h-screen bg-warm-cream">
      <header className="border-b border-slate-200 bg-white/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="font-sans font-bold text-xl text-sakneen-blue tracking-tight">
              sakneen
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500">
              {client?.displayName ?? "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600 hidden sm:inline">
              {session?.user?.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-charcoal hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-10">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
          Daily EOI Tracker
        </p>
        <h1 className="font-serif text-3xl text-charcoal mb-1">
          Expression of Interest Report
        </h1>
        <p className="text-sm text-slate-700 mt-1">Date: {todayLabel}</p>
        {wrongTenant ? (
          <p className="text-sm text-pill-rejected-fg">
            URL tenant `{subdomainSlug}` does not match your account. Open{" "}
            <a className="underline" href={`http://${client?.slug}.127.0.0.1.nip.io:3000/dashboard`}>
              {client?.slug}.127.0.0.1.nip.io:3000
            </a>{" "}
            instead.
          </p>
        ) : null}
      </section>

      <section className="max-w-5xl mx-auto px-6 mt-8 mb-16">
        {latestPublished ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500 mb-1">
              Coming next
            </p>
            <h2 className="font-serif text-xl text-charcoal mb-2">
              Data is published. Charts arrive in Day 8.
            </h2>
            <p className="text-sm text-slate-600">
              Latest publish at{" "}
              {latestPublished.publishedAt?.toISOString() ?? "unknown"}.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-warm-cream p-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500 mb-2">
              Empty state
            </p>
            <h2 className="font-serif text-2xl text-charcoal mb-2">
              No data published yet
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Sakneen has not published a report for you yet. You will see today&apos;s numbers
              here once it is live.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
