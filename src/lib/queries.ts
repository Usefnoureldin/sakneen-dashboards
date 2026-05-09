import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  clients,
  eoiUploads,
  users,
  type Client,
  type EoiUpload,
  type User,
} from "@/db/schema";

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

export async function listClientUsers(clientId: string): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(eq(users.clientId, clientId))
    .orderBy(asc(users.name));
}

export async function listSakneenAdmins(): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(and(eq(users.role, "sakneen_admin"), isNull(users.clientId)))
    .orderBy(asc(users.name));
}

export type AuditEntryWithRefs = {
  id: bigint;
  createdAt: Date;
  action: string;
  metadata: unknown;
  ipAddress: string | null;
  user: { id: string; email: string; name: string } | null;
  client: { id: string; slug: string; name: string } | null;
};

export async function listRecentAuditEntries(limit = 100): Promise<AuditEntryWithRefs[]> {
  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      action: auditLog.action,
      metadata: auditLog.metadata,
      ipAddress: auditLog.ipAddress,
      userId: auditLog.userId,
      userEmail: users.email,
      userName: users.name,
      clientId: auditLog.clientId,
      clientSlug: clients.slug,
      clientName: clients.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .leftJoin(clients, eq(clients.id, auditLog.clientId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    action: r.action,
    metadata: r.metadata,
    ipAddress: r.ipAddress,
    user: r.userId ? { id: r.userId, email: r.userEmail!, name: r.userName! } : null,
    client: r.clientId ? { id: r.clientId, slug: r.clientSlug!, name: r.clientName! } : null,
  }));
}
