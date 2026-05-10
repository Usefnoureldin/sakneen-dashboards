import Image from "next/image";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { signOut } from "@/auth";
import { db } from "@/db";
import { clients, eoiRecords, eoiUploads } from "@/db/schema";
import { buildDashboard } from "@/lib/aggregations";
import { requireActiveSession } from "@/lib/session-guard";
import { DashboardView } from "./dashboard-view";

export default async function DashboardHome() {
  const session = await requireActiveSession();
  const hdrs = await headers();
  const subdomainSlug = hdrs.get("x-tenant-slug");

  const userClientId = session?.user?.clientId ?? null;
  let client = null;
  if (userClientId) {
    [client] = await db.select().from(clients).where(eq(clients.id, userClientId)).limit(1);
  }

  const wrongTenant = subdomainSlug !== null && client !== null && subdomainSlug !== client.slug;

  const [latestPublished] = userClientId
    ? await db
        .select()
        .from(eoiUploads)
        .where(and(eq(eoiUploads.clientId, userClientId), eq(eoiUploads.status, "published")))
        .limit(1)
    : [];

  const records = latestPublished
    ? await db
        .select({
          eoiDate: eoiRecords.eoiDate,
          unitType: eoiRecords.unitType,
          status: eoiRecords.status,
          amountEgp: eoiRecords.amountEgp,
          bulkEoiId: eoiRecords.bulkEoiId,
          eoiCategory: eoiRecords.eoiCategory,
          eoiSource: eoiRecords.eoiSource,
          nationality: eoiRecords.nationality,
          brokerageName: eoiRecords.brokerageName,
        })
        .from(eoiRecords)
        .where(eq(eoiRecords.uploadId, latestPublished.id))
    : [];

  const initial =
    client && latestPublished
      ? buildDashboard({
          client: { slug: client.slug, displayName: client.displayName },
          upload: latestPublished,
          records: records.map((r) => ({
            eoiDate: String(r.eoiDate),
            unitType: r.unitType as "Residential" | "Admin",
            status: r.status as "approved" | "pending" | "rejected" | "canceled",
            amountEgp: Number(r.amountEgp),
            bulkEoiId: r.bulkEoiId,
            eoiCategory: r.eoiCategory,
            eoiSource: r.eoiSource,
            nationality: r.nationality,
            brokerageName: r.brokerageName,
          })),
        })
      : null;

  return (
    <div className="min-h-screen bg-warm-cream">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo/sakneen-logo.png"
              alt="Sakneen"
              width={107}
              height={32}
              priority
              className="h-8 w-auto"
            />
            <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500">
              {client?.displayName ?? "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/profile"
              className="text-xs text-slate-600 hover:text-charcoal hidden sm:inline"
            >
              {session?.user?.email}
            </a>
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

      {wrongTenant ? (
        <div className="max-w-6xl mx-auto px-6 pt-4">
          <div className="rounded-md border border-pill-rejected-fg/30 bg-pill-rejected-bg px-3 py-2 text-sm text-pill-rejected-fg">
            URL tenant `{subdomainSlug}` does not match your account. Open{" "}
            <a className="underline" href={`http://${client?.slug}.127.0.0.1.nip.io:3000/dashboard`}>
              {client?.slug}.127.0.0.1.nip.io:3000
            </a>{" "}
            instead.
          </div>
        </div>
      ) : null}

      {initial ? (
        <DashboardView initial={initial} />
      ) : (
        <main className="max-w-6xl mx-auto px-6 py-16">
          <div className="rounded-xl border border-slate-200 bg-warm-cream p-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-slate-500 mb-2">
              Empty state
            </p>
            <h2 className="font-serif text-2xl text-charcoal mb-2">No data published yet</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Sakneen has not published a report for you yet. You will see today&apos;s numbers here
              once it is live.
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
