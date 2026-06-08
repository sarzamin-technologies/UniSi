import { SigningForm } from "../../sign/[slug]/SigningForm";

export const dynamic = "force-dynamic";

/**
 * Iframe-friendly variant of the signing form. No app chrome, no AI Q&A
 * panel — just the document + signing controls. CSP/X-Frame-Options are
 * relaxed for this path in middleware so partner sites can embed.
 */
export default function EmbedSignPage({ params }: { params: { slug: string } }) {
  return (
    <div className="bg-white dark:bg-zinc-950">
      <SigningForm slug={params.slug} />
    </div>
  );
}
