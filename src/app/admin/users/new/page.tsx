import Link from "next/link";
import { InviteAdminForm } from "./invite-form";

export default function InviteAdminPage() {
  return (
    <main className="max-w-xl mx-auto px-6 pt-10 pb-16">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
        <Link href="/admin/users" className="hover:underline">
          Sakneen Admins
        </Link>
        {" · Invite"}
      </p>
      <h1 className="font-serif text-3xl text-charcoal mb-6">Invite a Sakneen admin</h1>
      <p className="text-sm text-slate-600 mb-6">
        New admins get the role <code className="font-mono">sakneen_admin</code> and can manage all
        clients and uploads.
      </p>
      <InviteAdminForm />
    </main>
  );
}
