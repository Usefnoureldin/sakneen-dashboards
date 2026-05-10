import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { ok: true, db: "ok", at: new Date().toISOString() },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, db: "fail", error: (e as Error).message },
      { status: 503 },
    );
  }
}
