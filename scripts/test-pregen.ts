import { config } from "dotenv";
config({ path: ".env.local", override: false });

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { eoiUploads, clients } from "@/db/schema";
import { generateUploadPdf } from "@/lib/pdf-generator";
import { savePdfReport } from "@/lib/uploads-storage";

async function main() {
  const draftId = process.argv[2];
  if (!draftId) {
    console.error("usage: tsx scripts/test-pregen.ts <draftId>");
    process.exit(1);
  }
  const [up] = await db.select().from(eoiUploads).where(eq(eoiUploads.id, draftId)).limit(1);
  if (!up) throw new Error("upload not found");
  const [client] = await db.select().from(clients).where(eq(clients.id, up.clientId)).limit(1);

  console.log(`-- supersede prior published & promote draft ${draftId}`);
  await db.transaction(async (tx) => {
    await tx
      .update(eoiUploads)
      .set({ status: "superseded" })
      .where(and(eq(eoiUploads.clientId, up.clientId), eq(eoiUploads.status, "published")));
    await tx
      .update(eoiUploads)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(eoiUploads.id, draftId));
  });

  console.log(`-- pre-generate PDF via headless Chromium`);
  const t0 = Date.now();
  const pdfBuffer = await generateUploadPdf({ uploadId: draftId, baseUrl: "http://localhost:3001" });
  console.log(`   gen took ${Date.now() - t0}ms, ${pdfBuffer.length.toLocaleString()} bytes`);

  const t1 = Date.now();
  const pdfPath = await savePdfReport({ clientId: up.clientId, uploadId: draftId, buffer: pdfBuffer });
  console.log(`   saved to ${pdfPath} in ${Date.now() - t1}ms`);

  await db.update(eoiUploads).set({ pdfPath }).where(eq(eoiUploads.id, draftId));
  console.log(`   pdf_path updated for client ${client?.displayName}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
