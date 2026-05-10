"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";

const ChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(10, "New password must be at least 10 characters")
      .max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

export type ChangeState = {
  ok?: boolean;
  error?: string;
};

export async function changePasswordAction(
  _prev: ChangeState,
  formData: FormData,
): Promise<ChangeState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const parsed = ChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) return { error: "User not found." };

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    await logAudit({
      userId: user.id,
      clientId: user.clientId,
      action: "password_change_failed",
      metadata: { reason: "wrong_current_password" },
    });
    return { error: "Current password is incorrect." };
  }

  if (currentPassword === newPassword) {
    return { error: "New password must be different from the current one." };
  }

  const hash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, user.id));

  await logAudit({
    userId: user.id,
    clientId: user.clientId,
    action: "password_change",
  });

  return { ok: true };
}
