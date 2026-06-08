import { getDb, template, attachment, type Template } from "@unisi/db";
import { putBlob } from "@unisi/storage";
import { getPageCount } from "@unisi/pdf";

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

export interface CreateTemplateError {
  error: string;
  status: 413 | 422 | 500;
}

/**
 * Shared pipeline for turning a PDF byte buffer into a ready-to-edit template:
 * validate it parses, persist the blob, record the attachment, and create the
 * template with a single document + a default "Signer" role. Used by both the
 * file-upload route and the Google Doc import route so the two can't drift.
 */
export async function createTemplateFromPdf(opts: {
  accountId: string;
  buf: Buffer;
  /** Display filename for the document (should end in .pdf). */
  filename: string;
  /** Optional template name; defaults to the filename without extension. */
  name?: string;
}): Promise<{ template: Template } | CreateTemplateError> {
  const { accountId, buf, filename } = opts;

  if (buf.byteLength > MAX_PDF_BYTES) {
    return { error: "file too large", status: 413 };
  }

  let pageCount: number;
  try {
    pageCount = await getPageCount(new Uint8Array(buf));
  } catch {
    return { error: "could not read PDF", status: 422 };
  }

  const put = await putBlob(buf, { mime: "application/pdf", filename });

  const db = getDb();
  const [att] = await db
    .insert(attachment)
    .values({
      accountId,
      kind: "template_document",
      blobSha256: put.sha256,
      s3Key: put.s3Key,
      sizeBytes: put.size,
      mime: "application/pdf",
      filename,
      metadata: { pageCount },
    })
    .returning();
  if (!att) return { error: "attachment_insert_failed", status: 500 };

  const [tpl] = await db
    .insert(template)
    .values({
      accountId,
      createdBy: accountId,
      name: opts.name?.trim() || filename.replace(/\.pdf$/i, ""),
      documents: [{ attachmentId: att.id, filename, pageCount }],
      submitterRoles: [{ name: "Signer", order: 0 }],
      fields: [],
    })
    .returning();
  if (!tpl) return { error: "template_insert_failed", status: 500 };

  return { template: tpl };
}
