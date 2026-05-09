import { auth, signOut } from "@/auth";

export default async function AdminHome() {
  const session = await auth();

  return (
    <main className="min-h-screen bg-warm-cream p-8">
      <div className="max-w-5xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
          Sakneen Admin
        </p>
        <h1 className="font-serif text-3xl text-charcoal mb-2">Active client dashboards</h1>
        <p className="text-sm text-slate-600 mb-8">
          Signed in as {session?.user?.email}. Day 6 will replace this with the real client list.
        </p>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm text-charcoal hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
