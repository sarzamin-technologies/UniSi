import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, template, attachment } from "@unisi/db";
import { putBlob } from "@unisi/storage";
import { markdownToPdf } from "@unisi/pdf";
import { requireAccountOrToken } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const Body = z.object({
  bodyMarkdown: z.string().min(1).max(200_000),
  title: z.string().min(1).max(200).optional(),
});

/**
 * Re-render an AI-drafted template after the user edited its markdown body.
 * Replaces the document attachment with a fresh PDF and rebuilds the field
 * list from the inline placeholders. Any custom fields the user manually
 * placed via drag-drop are dropped because their (x, y) on the OLD pdf no
 * longer applies to the new layout.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const db = getDb();
  const tpl = await db.query.template.findFirst({
    where: and(eq(template.id, params.id), eq(template.accountId, auth.accountId)),
  });
  if (!tpl) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const title = parsed.data.title ?? tpl.name;
  const rendered = await markdownToPdf({ title, body: parsed.data.bodyMarkdown });

  const safeName = title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const put = await putBlob(Buffer.from(rendered.bytes), {
    mime: "application/pdf",
    filename: `${safeName}.pdf`,
  });

  const [att] = await db
    .insert(attachment)
    .values({
      accountId: auth.accountId,
      kind: "template_document",
      blobSha256: put.sha256,
      s3Key: put.s3Key,
      sizeBytes: put.size,
      mime: "application/pdf",
      filename: `${title}.pdf`,
      metadata: { pageCount: rendered.pageCount, source: "ai_draft_edit" },
    })
    .returning();
  if (!att) return NextResponse.json({ error: "attachment_insert_failed" }, { status: 500 });

  const fields = rendered.placeholders.map((p) => ({
    id: crypto.randomUUID(),
    type: p.kind,
    pageIndex: p.pageIndex,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    required: true,
    submitterRole: p.role,
    label:
      p.label ??
      (p.kind === "signature"
        ? `Signature — ${p.role}`
        : p.kind === "initials"
          ? `Initials — ${p.role}`
          : p.kind === "date"
            ? `Date — ${p.role}`
            : p.kind),
  }));

  const [updated] = await db
    .update(template)
    .set({
      name: title,
      documents: [
        {
          attachmentId: att.id,
          filename: `${title}.pdf`,
          pageCount: rendered.pageCount,
          bodyMarkdown: parsed.data.bodyMarkdown,
        },
      ],
      fields,
      updatedAt: new Date(),
    })
    .where(eq(template.id, params.id))
    .returning();

  return NextResponse.json({ template: updated });
}
