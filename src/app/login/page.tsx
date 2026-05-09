import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    if (session.user.role === "sakneen_admin") redirect("/admin");
    if (session.user.role === "client_user") redirect("/dashboard");
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-warm-cream flex items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <h1 className="font-sans font-bold text-3xl text-sakneen-blue tracking-tight mb-8 text-center">
          sakneen
        </h1>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
            EOI Analytics Dashboard
          </p>
          <h2 className="font-serif text-2xl text-charcoal mb-6">Sign in</h2>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
