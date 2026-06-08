import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, submitter, submission, attachment } from "@unisi/db";
import { getBlob } from "@unisi/storage";

export const dynamic = "force-dynamic";

/**
 * Slug-gated streaming proxy for the signer-facing PDF preview. Authenticates
 * by checking that `attachmentId` is one of the documents in the submission
 * the slug belongs to — no Agnic auth required.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; attachmentId: string } },
) {
  const db = getDb();
  const sub = await db.query.submitter.findFirst({
    where: eq(submitter.slug, params.slug),
  });
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parent = await db.query.submission.findFirst({
    where: eq(submission.id, sub.submissionId),
  });
  if (!parent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const docs = (parent.templateSnapshot as { documents?: { attachmentId: string }[] }).documents ?? [];
  const allowed = docs.some((d) => d.attachmentId === params.attachmentId);
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const att = await db.query.attachment.findFirst({
    where: eq(attachment.id, params.attachmentId),
  });
  if (!att) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bytes = await getBlob(att.s3Key);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": att.mime,
      "Content-Length": String(att.sizeBytes),
      "Content-Disposition": att.filename
        ? `inline; filename="${att.filename.replace(/"/g, "")}"`
        : "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
