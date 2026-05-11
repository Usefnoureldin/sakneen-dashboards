import { config } from "dotenv";
config({ path: ".env.local", override: false });

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { eoiUploads } from "@/db/schema";
import { generateUploadPdf } from "@/lib/pdf-generator";
import { savePdfReport } from "@/lib/uploads-storage";

async function main() {
  const uploadId = process.argv[2];
  const baseUrl = process.argv[3] || "http://localhost:3000";
  if (!uploadId) {
    console.error("usage: tsx scripts/regen-pdf.ts <uploadId> [baseUrl]");
    process.exit(1);
  }
  const [up] = await db.select().from(eoiUploads).where(eq(eoiUploads.id, uploadId)).limit(1);
  if (!up) throw new Error("upload not found");

  const t0 = Date.now();
  const pdfBuffer = await generateUploadPdf({ uploadId, baseUrl });
  console.log(`gen ${Date.now() - t0}ms, ${pdfBuffer.length.toLocaleString()} bytes`);

  const pdfPath = await savePdfReport({ clientId: up.clientId, uploadId, buffer: pdfBuffer });
  await db.update(eoiUploads).set({ pdfPath }).where(eq(eoiUploads.id, uploadId));
  console.log(`saved -> ${pdfPath}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
