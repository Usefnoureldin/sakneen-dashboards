import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/queries";
import { InviteForm } from "./invite-form";

export default async function InviteClientUser({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  return (
    <main className="max-w-xl mx-auto px-6 pt-10 pb-16">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
        <Link href={`/admin/clients/${client.slug}`} className="hover:underline">
          {client.displayName}
        </Link>
        {" · Invite user"}
      </p>
      <h1 className="font-serif text-3xl text-charcoal mb-6">Invite a user to {client.displayName}</h1>
      <p className="text-sm text-slate-600 mb-6">
        New users get the role <code className="font-mono">client_user</code>, scoped to this
        client. They will be able to log in at <code className="font-mono">{client.slug}.sakneen.com</code>{" "}
        and view this dashboard.
      </p>
      <InviteForm slug={client.slug} clientName={client.displayName} />
    </main>
  );
}
