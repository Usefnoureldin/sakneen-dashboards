import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, eoiRecords, eoiUploads } from "@/db/schema";
import { buildDashboard } from "@/lib/aggregations";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const clientId = session.user.clientId;
  if (session.user.role !== "client_user" || !clientId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) {
    return NextResponse.json({ error: "client missing" }, { status: 404 });
  }

  const [upload] = await db
    .select()
    .from(eoiUploads)
    .where(and(eq(eoiUploads.clientId, clientId), eq(eoiUploads.status, "published")))
    .limit(1);

  if (!upload) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  const records = await db
    .select({
      eoiDate: eoiRecords.eoiDate,
      unitType: eoiRecords.unitType,
      status: eoiRecords.status,
      amountEgp: eoiRecords.amountEgp,
    })
    .from(eoiRecords)
    .where(eq(eoiRecords.uploadId, upload.id));

  const data = buildDashboard({
    client: { slug: client.slug, displayName: client.displayName },
    upload,
    records: records.map((r) => ({
      eoiDate: String(r.eoiDate),
      unitType: r.unitType as "Residential" | "Admin",
      status: r.status as "approved" | "pending" | "rejected",
      amountEgp: Number(r.amountEgp),
    })),
  });

  // BigInt-safe JSON: amounts are already Number after Number() coercion above.
  return NextResponse.json({ data });
}
