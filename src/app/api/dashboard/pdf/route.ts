import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, eoiUploads } from "@/db/schema";
import { logAudit, requestAuditContext } from "@/lib/audit";
import { generateUploadPdf, resolvePrintBaseUrl } from "@/lib/pdf-generator";
import { savePdfReport } from "@/lib/uploads-storage";

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

  const filename = pdfFilename(client.displayName, String(upload.dateMax));
  const responseHeaders = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, max-age=300",
  };

  // Fast path: pre-generated PDF on disk. This is the path 99% of downloads take.
  if (upload.pdfPath && existsSync(upload.pdfPath)) {
    const buffer = await readFile(upload.pdfPath);
    await logAudit({
      userId: session.user.id,
      clientId: client.id,
      action: "pdf_download",
      metadata: { uploadId: upload.id, bytes: buffer.length, source: "cache" },
      ...requestAuditContext(req),
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: responseHeaders,
    });
  }

  // Fallback: pre-gen never ran or the file was lost (e.g. uploads from before
  // pre-gen shipped, or volume reset). Generate inline, persist for next time.
  try {
    const baseUrl = resolvePrintBaseUrl(req.headers);
    const pdfBuffer = await generateUploadPdf({ uploadId: upload.id, baseUrl });

    // Persist for next time (best-effort).
    try {
      const pdfPath = await savePdfReport({
        clientId: client.id,
        uploadId: upload.id,
        buffer: pdfBuffer,
      });
      await db.update(eoiUploads).set({ pdfPath }).where(eq(eoiUploads.id, upload.id));
    } catch (cacheErr) {
      console.error("[pdf] failed to persist fallback cache:", cacheErr);
    }

    await logAudit({
      userId: session.user.id,
      clientId: client.id,
      action: "pdf_download",
      metadata: { uploadId: upload.id, bytes: pdfBuffer.length, source: "ondemand" },
      ...requestAuditContext(req),
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: responseHeaders,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `pdf generation failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
