import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, attachment } from "@unisi/db";
import { requireAccountOrToken } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

/**
 * Return attachment metadata + a same-origin streaming URL. The browser
 * fetches bytes via /api/attachments/<id>/file so PDFs stay same-origin
 * (no MinIO/S3 CORS config needed).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const row = await db.query.attachment.findFirst({
    where: and(eq(attachment.id, params.id), eq(attachment.accountId, auth.accountId)),
  });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    url: `/api/attachments/${row.id}/file`,
    filename: row.filename,
    mime: row.mime,
    size: row.sizeBytes,
  });
}
