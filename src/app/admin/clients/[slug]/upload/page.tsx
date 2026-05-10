import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientBySlug } from "@/lib/queries";
import { UploadForm } from "./upload-form";

export default async function UploadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  return (
    <main className="max-w-3xl mx-auto px-6 pt-10 pb-16">
      <p className="font-mono text-[10px] uppercase tracking-[2px] text-terracotta mb-1.5">
        <Link href={`/admin/clients/${client.slug}`} className="hover:underline">
          {client.displayName}
        </Link>
        {" · "}New upload
      </p>
      <h1 className="font-serif text-3xl text-charcoal mb-6">Upload daily EOI export</h1>
      <p className="text-sm text-slate-600 mb-6">
        Drop the daily Sakneen EOI export. The parser maps columns by name (Number of EOI, Unit
        Type, Status, Timestamp, EOI Value) and accepts both serial and text dates. Rows missing
        unit type or with an unsupported status are dropped and reported in the preview.
      </p>
      <UploadForm slug={client.slug} />
    </main>
  );
}
