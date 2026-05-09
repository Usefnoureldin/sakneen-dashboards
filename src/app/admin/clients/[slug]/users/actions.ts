"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { clients, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { generatePassword, hashPassword } from "@/lib/passwords";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "sakneen_admin") {
    throw new Error("forbidden");
  }
  return session;
}

async function loadClient(slug: string) {
  const [c] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
  if (!c) throw new Error(`client not found: ${slug}`);
  return c;
}

const InviteSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().trim().min(1).max(120),
  password: z
    .string()
    .min(8)
    .max(128)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});

export type InviteState = {
  ok?: boolean;
  error?: string;
  createdEmail?: string;
  createdPassword?: string;
  generated?: boolean;
};

export async function inviteClientUserAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const slug = String(formData.get("slug") ?? "");
  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { email, name, password } = parsed.data;

  let client;
  try {
    client = await loadClient(slug);
  } catch (e) {
    return { error: (e as Error).message };
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return { error: `A user with email ${email} already exists.` };
  }

  const finalPassword = password ?? generatePassword();
  const hash = await hashPassword(finalPassword);

  const [created] = await db
    .insert(users)
    .values({
      email,
      name,
      passwordHash: hash,
      role: "client_user",
      clientId: client.id,
    })
    .returning();

  await logAudit({
    userId: session.user.id,
    clientId: client.id,
    action: "user_create",
    metadata: { newUserId: created.id, email, role: "client_user" },
  });

  revalidatePath(`/admin/clients/${slug}`);

  return {
    ok: true,
    createdEmail: created.email,
    createdPassword: finalPassword,
    generated: !password,
  };
}

export async function deactivateClientUserAction(formData: FormData) {
  const session = await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("userId required");

  const client = await loadClient(slug);
  if (userId === session.user.id) throw new Error("cannot deactivate yourself");

  const [target] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.clientId, client.id)))
    .limit(1);
  if (!target) throw new Error(`user not found in client ${slug}`);

  await db.update(users).set({ active: false }).where(eq(users.id, userId));

  await logAudit({
    userId: session.user.id,
    clientId: client.id,
    action: "user_deactivate",
    metadata: { targetUserId: userId, email: target.email },
  });

  revalidatePath(`/admin/clients/${slug}`);
}

export async function reactivateClientUserAction(formData: FormData) {
  const session = await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("userId required");

  const client = await loadClient(slug);
  await db
    .update(users)
    .set({ active: true })
    .where(and(eq(users.id, userId), eq(users.clientId, client.id)));

  await logAudit({
    userId: session.user.id,
    clientId: client.id,
    action: "user_reactivate",
    metadata: { targetUserId: userId },
  });

  revalidatePath(`/admin/clients/${slug}`);
}
