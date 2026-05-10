import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Verifies the session principal is still active in the DB. If the admin
 * deactivated the user since their JWT was minted, kill the session and bounce
 * to /login. Call this from any server layout/page that should respect
 * deactivation immediately.
 */
export async function requireActiveSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [u] = await db
    .select({ active: users.active })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!u || !u.active) {
    await signOut({ redirect: false });
    redirect("/login?from=deactivated");
  }
  return session;
}
