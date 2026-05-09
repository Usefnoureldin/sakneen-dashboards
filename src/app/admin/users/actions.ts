"use server";

import { revalidatePath } from "next/cache";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { generatePassword, hashPassword } from "@/lib/passwords";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "sakneen_admin") {
    throw new Error("forbidden");
  }
  return session;
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

export type InviteAdminState = {
  ok?: boolean;
  error?: string;
  createdEmail?: string;
  createdPassword?: string;
  generated?: boolean;
};

export async function inviteAdminAction(
  _prev: InviteAdminState,
  formData: FormData,
): Promise<InviteAdminState> {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return { error: "Forbidden." };
  }

  const parsed = InviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { email, name, password } = parsed.data;

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
      role: "sakneen_admin",
      clientId: null,
    })
    .returning();

  await logAudit({
    userId: session.user.id,
    action: "user_create",
    metadata: { newUserId: created.id, email, role: "sakneen_admin" },
  });

  revalidatePath("/admin/users");

  return {
    ok: true,
    createdEmail: created.email,
    createdPassword: finalPassword,
    generated: !password,
  };
}

export async function deactivateAdminAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("userId required");
  if (userId === session.user.id) throw new Error("cannot deactivate yourself");

  const [target] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.role, "sakneen_admin"), isNull(users.clientId)))
    .limit(1);
  if (!target) throw new Error("admin user not found");

  await db.update(users).set({ active: false }).where(eq(users.id, userId));

  await logAudit({
    userId: session.user.id,
    action: "user_deactivate",
    metadata: { targetUserId: userId, email: target.email },
  });

  revalidatePath("/admin/users");
}

export async function reactivateAdminAction(formData: FormData) {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("userId required");

  await db
    .update(users)
    .set({ active: true })
    .where(and(eq(users.id, userId), eq(users.role, "sakneen_admin"), isNull(users.clientId)));

  await logAudit({
    userId: session.user.id,
    action: "user_reactivate",
    metadata: { targetUserId: userId },
  });

  revalidatePath("/admin/users");
}
