import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, submission, submitter } from "@unisi/db";
import { requireAccountOrToken } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const sub = await db.query.submission.findFirst({
    where: and(eq(submission.id, params.id), eq(submission.accountId, auth.accountId)),
  });
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const submitters = await db
    .select()
    .from(submitter)
    .where(eq(submitter.submissionId, sub.id));
  return NextResponse.json({ submission: sub, submitters });
}
