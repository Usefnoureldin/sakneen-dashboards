import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, eoiUploads } from "@/db/schema";
import { signPdfToken } from "@/lib/pdf-token";
import { logAudit, requestAuditContext } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

function pdfFilename(clientName: string, dateMax: string): string {
  const safeName = clientName.replace(/[^A-Za-z0-9]+/g, "_");
  const ymd = dateMax.replaceAll("-", "");
  return `${safeName}_EOI_Report_${ymd}.pdf`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.user.role !== "client_user" || !session.user.clientId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const clientId = session.user.clientId;

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return NextResponse.json({ error: "client missing" }, { status: 404 });

  const [upload] = await db
    .select()
    .from(eoiUploads)
    .where(and(eq(eoiUploads.clientId, clientId), eq(eoiUploads.status, "published")))
    .limit(1);
  if (!upload) {
    return NextResponse.json({ error: "no published report" }, { status: 404 });
  }

  const token = signPdfToken(upload.id);
  const baseUrl =
    process.env.PRINT_BASE_URL ||
    new URL(req.url).origin.replace(/^https?:\/\/[^.]+\.127\.0\.0\.1\.nip\.io/, "http://localhost");
  const printUrl = `${baseUrl}/print/${upload.id}?token=${encodeURIComponent(token)}`;

  // Lazy import so the heavy playwright dep isn't loaded for routes that don't need it.
  const { chromium } = await import("playwright");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle", timeout: 30_000 });
    // Wait for the React tree (incl. Recharts) to commit.
    await page
      .waitForSelector('#print-ready[data-ready="1"]', { timeout: 10_000 })
      .catch(() => {});
    // Small extra beat so chart animations (already disabled) and fonts settle.
    await page.waitForTimeout(400);

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    await logAudit({
      userId: session.user.id,
      clientId: client.id,
      action: "pdf_download",
      metadata: { uploadId: upload.id, bytes: pdfBuffer.length },
      ...requestAuditContext(req),
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFilename(client.displayName, String(upload.dateMax))}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `pdf generation failed: ${(e as Error).message}` },
      { status: 500 },
    );
  } finally {
    await browser.close();
  }
}
