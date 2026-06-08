import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, submission, attachment } from "@unisi/db";
import { requireAccountOrToken } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

/** Return same-origin streaming URLs for the completed documents. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const sub = await db.query.submission.findFirst({
    where: and(eq(submission.id, params.id), eq(submission.accountId, auth.accountId)),
  });
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const docs = await db
    .select()
    .from(attachment)
    .where(
      and(
        eq(attachment.accountId, auth.accountId),
        inArray(attachment.kind, ["completed_document", "audit_trail"]),
        sql`${attachment.metadata} ->> 'submissionId' = ${params.id}`,
      ),
    );

  const documents = docs
    .filter((d) => d.kind === "completed_document")
    .map((d) => ({
      id: d.id,
      filename: d.filename ?? "signed.pdf",
      url: `/api/attachments/${d.id}/file`,
    }));

  const auditTrail = docs
    .filter((d) => d.kind === "audit_trail")
    .map((d) => ({
      id: d.id,
      filename: d.filename ?? "audit-trail.pdf",
      url: `/api/attachments/${d.id}/file`,
      signed: Boolean((d.metadata as { signed?: boolean } | null)?.signed),
    }));

  return NextResponse.json({ documents, auditTrail });
}
