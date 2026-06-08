import crypto from "node:crypto";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { getDb, template, attachment } from "@unisi/db";
import { putBlob } from "@unisi/storage";
import { markdownToPdf, type RenderedPlaceholder } from "@unisi/pdf";
import { draftTemplate } from "@unisi/ai";

interface JobData {
  templateId: string;
  accountId: string;
  prompt: string;
}

interface TemplateField {
  id: string;
  type: "signature" | "initials" | "date" | "text" | "checkbox" | "number" | "email" | "phone";
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  submitterRole: string;
  label?: string;
}

/**
 * Fill in a previously created "drafting…" template by:
 *   1. Asking the model for title + body + roles
 *   2. Rendering the markdown body to a PDF — inline `[FIELD: ...]` markers
 *      become labeled blanks AND template fields with their actual on-page
 *      coordinates (no more bottom-stacked fallbacks)
 *   3. Persisting the document attachment + updating the template row
 *   4. Saving the markdown body on the document so the builder can let the
 *      user edit and re-render later.
 */
export async function draftTemplateHandler(job: Job<JobData>): Promise<{ templateId: string }> {
  const db = getDb();
  const { templateId, accountId, prompt } = job.data;

  const tpl = await db.query.template.findFirst({ where: eq(template.id, templateId) });
  if (!tpl) throw new Error(`template ${templateId} not found`);

  const drafted = await draftTemplate({ accountId, prompt });
  const rendered = await markdownToPdf({ title: drafted.title, body: drafted.body });

  const safeName = drafted.title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  const put = await putBlob(Buffer.from(rendered.bytes), {
    mime: "application/pdf",
    filename: `${safeName}.pdf`,
  });

  const [att] = await db
    .insert(attachment)
    .values({
      accountId,
      kind: "template_document",
      blobSha256: put.sha256,
      s3Key: put.s3Key,
      sizeBytes: put.size,
      mime: "application/pdf",
      filename: `${drafted.title}.pdf`,
      metadata: { pageCount: rendered.pageCount, source: "ai_draft" },
    })
    .returning();
  if (!att) throw new Error("attachment insert failed");

  const fields = placeholdersToFields(rendered.placeholders);

  await db
    .update(template)
    .set({
      name: drafted.title,
      documents: [
        {
          attachmentId: att.id,
          filename: `${drafted.title}.pdf`,
          pageCount: rendered.pageCount,
          // Source markdown — used by the builder's "Edit document" mode to
          // re-render the PDF after the user tweaks the body.
          bodyMarkdown: drafted.body,
        },
      ],
      submitterRoles: drafted.roles.map((name, order) => ({ name, order })),
      fields,
      updatedAt: new Date(),
    })
    .where(eq(template.id, templateId));

  return { templateId };
}

export function placeholdersToFields(placeholders: RenderedPlaceholder[]): TemplateField[] {
  return placeholders.map((p) => ({
    id: crypto.randomUUID(),
    type: p.kind,
    pageIndex: p.pageIndex,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    required: true,
    submitterRole: p.role,
    label: labelFor(p),
  }));
}

function labelFor(p: RenderedPlaceholder): string {
  if (p.label) return p.label;
  switch (p.kind) {
    case "signature":
      return `Signature — ${p.role}`;
    case "initials":
      return `Initials — ${p.role}`;
    case "date":
      return `Date — ${p.role}`;
    default:
      return p.kind;
  }
}
