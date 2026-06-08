import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, submitter, submission } from "@unisi/db";
import { appendAuditEvent } from "@unisi/audit";
import { emitWebhook, submissionPayload } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

/**
 * Public, slug-gated. Loads the submitter and returns enough state for the
 * signing form to render: the submitter's fields, all documents, presigned
 * URLs to fetch the PDFs from the browser. No Agnic auth required.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const db = getDb();
  const sub = await db.query.submitter.findFirst({
    where: eq(submitter.slug, params.slug),
  });
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parent = await db.query.submission.findFirst({
    where: eq(submission.id, sub.submissionId),
  });
  if (!parent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const snapshot = parent.templateSnapshot as {
    name: string;
    documents: { attachmentId: string; filename: string; pageCount: number }[];
    fields: { id: string; submitterRole: string; pageIndex: number; x: number; y: number; w: number; h: number; type: string; required?: boolean; label?: string }[];
    submitterRoles: { name: string; order: number }[];
  };

  // Side effect: mark "opened" on first GET. The update is gated on
  // openedAt IS NULL so concurrent first-opens can't both win — only the
  // request that actually flips the column (returns a row) fires the audit
  // event + webhook, so "opened" is emitted exactly once per signer.
  if (!sub.openedAt) {
    const [flipped] = await db
      .update(submitter)
      .set({
        openedAt: new Date(),
        status: sub.status === "pending" ? "opened" : sub.status,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        ua: req.headers.get("user-agent") ?? null,
      })
      .where(and(eq(submitter.id, sub.id), isNull(submitter.openedAt)))
      .returning({ id: submitter.id });

    if (flipped) {
      await appendAuditEvent({
        submissionId: sub.submissionId,
        submitterId: sub.id,
        type: "submitter.opened",
        payload: { ip: req.headers.get("x-forwarded-for") ?? null },
      });
      // Notify subscribers that a signer opened the document.
      const allSubmitters = await db
        .select()
        .from(submitter)
        .where(eq(submitter.submissionId, sub.submissionId));
      await emitWebhook({
        accountId: parent.accountId,
        event: "submitter.opened",
        data: submissionPayload(parent, allSubmitters),
      });
    }
  }

  // Same-origin streaming URL (slug-gated) so the browser doesn't need
  // MinIO/S3 CORS configured. The /files/<id> handler verifies the
  // attachment belongs to this submission.
  const documentsWithUrls = snapshot.documents.map((d) => ({
    ...d,
    url: `/api/sign/${params.slug}/files/${d.attachmentId}`,
  }));

  // Only return fields the *current* submitter has to fill, but include all so
  // the UI can also render read-only siblings if it wants to.
  const myFields = snapshot.fields.filter((f) => f.submitterRole === sub.role);

  return NextResponse.json({
    submitter: {
      id: sub.id,
      role: sub.role,
      name: sub.name,
      email: sub.email,
      status: sub.status,
      fieldValues: sub.fieldValues,
      completedAt: sub.completedAt,
    },
    submission: {
      id: parent.id,
      status: parent.status,
    },
    template: {
      name: snapshot.name,
      documents: documentsWithUrls,
      fields: myFields,
      allFields: snapshot.fields,
    },
  });
}
