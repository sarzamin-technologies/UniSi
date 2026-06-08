import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, attachment } from "@unisi/db";
import { getBlob } from "@unisi/storage";
import { requireAccountOrToken } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

/**
 * Stream the raw bytes of an attachment to the browser. Used by pdfjs in the
 * builder so the PDF download stays same-origin (no MinIO/S3 CORS dance).
 *
 * In production you can swap this for a 302 redirect to a presigned URL once
 * the bucket has CORS configured for your app's origin — the wire shape
 * stays identical.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const row = await db.query.attachment.findFirst({
    where: and(eq(attachment.id, params.id), eq(attachment.accountId, auth.accountId)),
  });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bytes = await getBlob(row.s3Key);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.sizeBytes),
      "Content-Disposition": row.filename
        ? `inline; filename="${row.filename.replace(/"/g, "")}"`
        : "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
