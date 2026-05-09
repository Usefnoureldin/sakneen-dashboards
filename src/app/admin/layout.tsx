import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-warm-cream">
      <header className="border-b border-slate-200 bg-white/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-5">
            <Link
              href="/admin"
              className="font-sans font-bold text-xl text-sakneen-blue tracking-tight hover:opacity-80"
            >
              sakneen
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate-500">
              Admin
            </span>
            <nav className="hidden sm:flex items-center gap-3 text-xs text-slate-600">
              <Link href="/admin" className="hover:text-charcoal">
                Clients
              </Link>
              <span className="text-slate-300">·</span>
              <Link href="/admin/users" className="hover:text-charcoal">
                Admins
              </Link>
              <span className="text-slate-300">·</span>
              <Link href="/admin/audit" className="hover:text-charcoal">
                Audit
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-600 hidden sm:inline">{session?.user?.email}</span>
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
        </div>
      </header>
      {children}
    </div>
  );
}
