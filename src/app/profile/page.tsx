import Link from "next/link";
import { signOut } from "@/auth";
import { requireActiveSession } from "@/lib/session-guard";
import { ChangePasswordForm } from "./change-password-form";

export default async function ProfilePage() {
  const session = await requireActiveSession();
  const homeHref = session.user.role === "sakneen_admin" ? "/admin" : "/dashboard";

  return (
    <div className="min-h-screen bg-warm-cream">
      <header className="border-b border-slate-200 bg-white/60 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <Link
              href={homeHref}
              className="font-sans font-bold text-xl text-sakneen-blue tracking-tight hover:opacity-80"
            >
              sakneen
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500">
              Profile
            </span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-charcoal hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-10 pb-16">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
          Account
        </p>
        <h1 className="font-serif text-3xl text-charcoal mb-1">Your profile</h1>
        <p className="text-sm text-slate-700 mt-1 mb-8">
          Signed in as {session.user.email} ({session.user.role.replace("_", " ")}).
        </p>

        <h2 className="font-serif text-xl text-charcoal mb-4">Change password</h2>
        <ChangePasswordForm />
      </main>
    </div>
  );
}
