import { db } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditEntry = {
  userId?: string | null;
  clientId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Insert one row into audit_log. Never throws — auditing must not break the parent operation.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: entry.userId ?? null,
      clientId: entry.clientId ?? null,
      action: entry.action,
      metadata: entry.metadata ? entry.metadata : null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    // Don't bubble errors from auditing.
    console.error("audit log insert failed", err);
  }
}

/** Pull common request context for log entries. */
export function requestAuditContext(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ipAddress, userAgent };
}
