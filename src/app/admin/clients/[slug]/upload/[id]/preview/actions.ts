"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, eoiUploads } from "@/db/schema";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthenticated");
  if (session.user.role !== "sakneen_admin") throw new Error("forbidden");
  return session;
}

async function loadDraft(slug: string, uploadId: string) {
  const [client] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
  if (!client) throw new Error(`client not found: ${slug}`);
  const [upload] = await db
    .select()
    .from(eoiUploads)
    .where(and(eq(eoiUploads.id, uploadId), eq(eoiUploads.clientId, client.id)))
    .limit(1);
  if (!upload) throw new Error(`upload not found: ${uploadId}`);
  if (upload.status !== "draft") {
    throw new Error(`upload is ${upload.status}, not draft`);
  }
  return { client, upload };
}

export async function publishUploadAction(formData: FormData) {
  const session = await requireAdmin();
  const slug = String(formData.get("slug"));
  const uploadId = String(formData.get("uploadId"));
  const { client } = await loadDraft(slug, uploadId);

  await db.transaction(async (tx) => {
    // Supersede the prior published upload for this client.
    await tx
      .update(eoiUploads)
      .set({ status: "superseded" })
      .where(and(eq(eoiUploads.clientId, client.id), eq(eoiUploads.status, "published")));
    // Promote this draft.
    await tx
      .update(eoiUploads)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(eoiUploads.id, uploadId));
  });

  await logAudit({
    userId: session.user.id,
    clientId: client.id,
    action: "upload_publish",
    metadata: { uploadId },
  });

  revalidatePath(`/admin/clients/${slug}`);
  revalidatePath("/admin");
  redirect(`/admin/clients/${slug}`);
}

export async function discardUploadAction(formData: FormData) {
  const session = await requireAdmin();
  const slug = String(formData.get("slug"));
  const uploadId = String(formData.get("uploadId"));
  const { client } = await loadDraft(slug, uploadId);

  await db.update(eoiUploads).set({ status: "discarded" }).where(eq(eoiUploads.id, uploadId));

  await logAudit({
    userId: session.user.id,
    clientId: client.id,
    action: "upload_discard",
    metadata: { uploadId },
  });

  revalidatePath(`/admin/clients/${slug}`);
  redirect(`/admin/clients/${slug}`);
}
