import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, eoiUploads, type Client, type EoiUpload } from "@/db/schema";

export type ClientWithLatest = {
  client: Client;
  lastPublished: EoiUpload | null;
};

export async function listClientsWithLatestPublished(): Promise<ClientWithLatest[]> {
  const rows = await db.select().from(clients).orderBy(asc(clients.name));
  const out: ClientWithLatest[] = [];
  for (const c of rows) {
    const [latest] = await db
      .select()
      .from(eoiUploads)
      .where(and(eq(eoiUploads.clientId, c.id), eq(eoiUploads.status, "published")))
      .limit(1);
    out.push({ client: c, lastPublished: latest ?? null });
  }
  return out;
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  const [c] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
  return c ?? null;
}

export async function listUploadsForClient(clientId: string): Promise<EoiUpload[]> {
  return db
    .select()
    .from(eoiUploads)
    .where(eq(eoiUploads.clientId, clientId))
    .orderBy(desc(eoiUploads.uploadedAt));
}

export async function getUpload(uploadId: string, clientId: string): Promise<EoiUpload | null> {
  const [u] = await db
    .select()
    .from(eoiUploads)
    .where(and(eq(eoiUploads.id, uploadId), eq(eoiUploads.clientId, clientId)))
    .limit(1);
  return u ?? null;
}
