import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, eoiRecords, eoiUploads } from "@/db/schema";
import { ExcelParseError, parseEoiWorkbook } from "@/lib/excel-parser";
import { saveUpload } from "@/lib/uploads-storage";
import { logAudit, requestAuditContext } from "@/lib/audit";

export const runtime = "nodejs";

const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024);
const ALLOWED_EXT = [".xlsx", ".xls"];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (session.user.role !== "sakneen_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { slug } = await ctx.params;
  const [client] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
  if (!client) {
    return NextResponse.json({ error: `client not found: ${slug}` }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return badRequest("expected multipart/form-data with a 'file' field");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return badRequest("missing 'file' field in form data");
  }

  if (file.size === 0) return badRequest("file is empty");
  if (file.size > MAX_BYTES) {
    return badRequest(`file exceeds ${MAX_BYTES} byte limit`);
  }

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_EXT.includes(ext)) {
    return badRequest(`file extension ${ext} not allowed; expected ${ALLOWED_EXT.join(" or ")}`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = parseEoiWorkbook(buffer);
  } catch (e) {
    if (e instanceof ExcelParseError) {
      return badRequest(e.message);
    }
    throw e;
  }

  const uploadId = randomUUID();
  let filePath: string;
  try {
    filePath = await saveUpload({ clientId: client.id, uploadId, buffer });
  } catch (e) {
    return NextResponse.json(
      { error: `could not save upload to disk: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  // Transactional insert: upload + records.
  try {
    await db.transaction(async (tx) => {
      await tx.insert(eoiUploads).values({
        id: uploadId,
        clientId: client.id,
        uploadedBy: session.user.id,
        status: "draft",
        filePath,
        fileName: file.name,
        fileSizeBytes: file.size,
        rowCount: parsed.summary.rowCount,
        dateMin: parsed.summary.dateMin,
        dateMax: parsed.summary.dateMax,
        totalCount: parsed.summary.totalCount,
        totalValueEgp: parsed.summary.totalValueEgp,
        parseWarnings: parsed.summary.warnings.length > 0 ? parsed.summary.warnings : null,
      });

      // Chunk the records insert to keep the parameter count manageable.
      const CHUNK = 500;
      for (let i = 0; i < parsed.records.length; i += CHUNK) {
        const slice = parsed.records.slice(i, i + CHUNK);
        await tx.insert(eoiRecords).values(
          slice.map((r) => ({
            uploadId,
            clientId: client.id,
            unitType: r.unitType,
            status: r.status,
            eoiDate: r.eoiDate,
            amountEgp: BigInt(r.amountEgp),
            sourceRowIndex: r.sourceRowIndex,
            bulkEoiId: r.bulkEoiId,
            eoiCategory: r.eoiCategory,
            eoiSource: r.eoiSource,
            nationality: r.nationality,
            brokerageName: r.brokerageName,
          })),
        );
      }
    });
  } catch (e) {
    return NextResponse.json(
      { error: `database insert failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }

  await logAudit({
    userId: session.user.id,
    clientId: client.id,
    action: "upload_create",
    metadata: {
      uploadId,
      fileName: file.name,
      rowCount: parsed.summary.rowCount,
    },
    ...requestAuditContext(req),
  });

  return NextResponse.json(
    {
      uploadId,
      clientSlug: client.slug,
      summary: {
        rowCount: parsed.summary.rowCount,
        dateMin: parsed.summary.dateMin,
        dateMax: parsed.summary.dateMax,
        totalCount: parsed.summary.totalCount,
        totalValueEgp: parsed.summary.totalValueEgp.toString(),
        statusCounts: parsed.summary.statusCounts,
        typeCounts: parsed.summary.typeCounts,
        warnings: parsed.summary.warnings,
      },
    },
    { status: 201 },
  );
}
