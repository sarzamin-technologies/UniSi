import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { getDb, template, attachment } from "@unisi/db";
import { getBlob } from "@unisi/storage";
import { renderPdfPagesToPng, extractPdfTextItems } from "@unisi/pdf";
import {
  detectFields,
  detectedToTemplateFields,
  snapDetectedFields,
  InsufficientBalanceError,
  type SnapPage,
} from "@unisi/ai";

interface JobData {
  templateId: string;
  accountId: string;
  /** When false, fields are *appended* to existing ones; when true, replace. */
  replace?: boolean;
}

export async function detectFieldsHandler(job: Job<JobData>): Promise<{ added: number }> {
  const db = getDb();
  const { templateId, accountId, replace } = job.data;

  const tpl = await db.query.template.findFirst({ where: eq(template.id, templateId) });
  if (!tpl) throw new Error(`template ${templateId} not found`);
  if (tpl.accountId !== accountId) throw new Error("account mismatch");

  // Render every PDF page across all template documents to PNG buffers.
  const docs = tpl.documents as { attachmentId: string; filename: string; pageCount: number }[];
  const allPages: { pageIndex: number; png: Buffer; widthPx: number; heightPx: number }[] = [];
  // Positioned text per page (global pageIndex), used to snap fields onto the
  // document's real underline blanks after vision detection.
  const textPages: SnapPage[] = [];
  let pageOffset = 0;
  const docOffsets: { filename: string; offset: number; count: number }[] = [];

  for (const d of docs) {
    const att = await db.query.attachment.findFirst({
      where: eq(attachment.id, d.attachmentId),
    });
    if (!att) continue;
    const bytes = await getBlob(att.s3Key);
    const rendered = await renderPdfPagesToPng(new Uint8Array(bytes), { scale: 1.5 });
    docOffsets.push({ filename: d.filename, offset: pageOffset, count: rendered.length });
    for (const r of rendered) {
      allPages.push({
        pageIndex: pageOffset + r.pageIndex,
        png: r.png,
        widthPx: r.widthPx,
        heightPx: r.heightPx,
      });
    }
    // Text geometry is best-effort — if extraction fails (e.g. scanned PDF),
    // detection still works, fields just won't snap.
    try {
      const docText = await extractPdfTextItems(new Uint8Array(bytes));
      for (const p of docText) {
        textPages.push({ pageIndex: pageOffset + p.pageIndex, items: p.items });
      }
    } catch (err) {
      console.warn(`[detect-fields] text extraction failed for ${d.filename}:`, err);
    }
    pageOffset += rendered.length;
  }

  if (allPages.length === 0) return { added: 0 };

  // Pass existing roles so the model reuses them rather than coining
  // synonyms (e.g. "Tenant" stays "Tenant", not "Renter").
  const existingRoles = (
    (tpl.submitterRoles as Array<{ name?: string }> | null) ?? []
  )
    .map((r) => r?.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);

  // Detect over the whole stack — Claude vision handles up to ~20 images per call.
  // For >20 pages, batch in chunks of 15 and merge.
  const detected = [];
  const CHUNK = 15;
  for (let i = 0; i < allPages.length; i += CHUNK) {
    const chunk = allPages.slice(i, i + CHUNK);
    try {
      const fields = await detectFields({
        accountId,
        existingRoles,
        pages: chunk.map((p) => ({
          pageIndex: p.pageIndex,
          png: p.png,
          widthPx: p.widthPx,
          heightPx: p.heightPx,
        })),
      });
      detected.push(...fields);
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        throw err;
      }
      throw err;
    }
  }

  // Snap detected fields onto the document's real underline blanks. Vision
  // nails the type/role but its coordinates drift; the text geometry pins them.
  const snapped = snapDetectedFields(detected, textPages);
  const newFields = detectedToTemplateFields(snapped);
  const mergedFields = replace
    ? newFields
    : [...((tpl.fields as Array<Record<string, unknown>>) ?? []), ...newFields];

  // Merge any roles the AI introduced into submitterRoles so the builder's
  // sidebar surfaces them with their own color.
  const existingNames = new Set(existingRoles);
  const detectedNames = Array.from(new Set(newFields.map((f) => f.submitterRole))).filter(
    (n) => !existingNames.has(n),
  );
  const mergedRoles = [
    ...((tpl.submitterRoles as Array<{ name: string; order: number }> | null) ?? []),
    ...detectedNames.map((name, i) => ({ name, order: existingNames.size + i })),
  ];

  await db
    .update(template)
    .set({ fields: mergedFields, submitterRoles: mergedRoles, updatedAt: new Date() })
    .where(eq(template.id, templateId));

  return { added: newFields.length };
}
