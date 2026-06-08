import crypto from "node:crypto";
import type { Job } from "bullmq";
import { eq, desc } from "drizzle-orm";
import {
  getDb,
  submission,
  submitter,
  attachment,
  account,
  auditEvent,
  type Submitter,
} from "@unisi/db";
import { getBlob, putBlob } from "@unisi/storage";
import { stampFields, buildSignedAuditTrail, extractPdfText, type StampInput } from "@unisi/pdf";
import { appendAuditEvent, verifyAuditChain } from "@unisi/audit";
import { extractStructured, InsufficientBalanceError } from "@unisi/ai";
import { renderSignedCopyEmail } from "@unisi/email";
import { emitWebhook, submissionPayload } from "../lib/webhooks";
import { getQueue, Queues } from "../queues";

type EmailAttachmentRef = { s3Key: string; filename: string; mime?: string };

interface StampJobData {
  submissionId: string;
}

/**
 * Stamp every signed field across every document in the submission, append
 * the audit-trail certificate page, and persist the final attachment.
 *
 * Field coordinates are normalized [0,1] top-left and converted to pdf-lib's
 * bottom-left points inside `stampFields`.
 */
export async function pdfStampHandler(job: Job<StampJobData>): Promise<{ documentIds: string[] }> {
  const db = getDb();
  const { submissionId } = job.data;

  const sub = await db.query.submission.findFirst({ where: eq(submission.id, submissionId) });
  if (!sub) throw new Error(`submission ${submissionId} not found`);

  const submitters = await db
    .select()
    .from(submitter)
    .where(eq(submitter.submissionId, submissionId));

  const snapshot = sub.templateSnapshot as {
    name: string;
    documents: { attachmentId: string; filename: string; pageCount: number }[];
    fields: {
      id: string;
      submitterRole: string;
      pageIndex: number;
      x: number;
      y: number;
      w: number;
      h: number;
      type: StampInput["type"];
      required?: boolean;
      label?: string;
    }[];
  };

  const completedAttachmentIds: string[] = [];
  const docHashes: { filename: string; sha256: string }[] = [];
  const emailAttachments: EmailAttachmentRef[] = [];

  for (const docMeta of snapshot.documents) {
    const att = await db.query.attachment.findFirst({
      where: eq(attachment.id, docMeta.attachmentId),
    });
    if (!att) throw new Error(`attachment ${docMeta.attachmentId} missing`);
    const original = await getBlob(att.s3Key);

    const stampInputs = await collectStampInputs(snapshot.fields, submitters);
    const stamped = await stampFields(new Uint8Array(original), stampInputs);

    // The signed document is kept clean (no certificate page). Its SHA-256 is
    // the hash of the final file stored below, recorded in the audit trail so
    // tampering with either the document or the trail is detectable.
    const documentSha256 = crypto.createHash("sha256").update(stamped).digest("hex");

    await appendAuditEvent({
      submissionId,
      type: "submission.stamped",
      payload: { documentAttachmentId: att.id, documentSha256 },
    });

    const chainBad = await verifyAuditChain(submissionId);
    if (chainBad !== -1) throw new Error(`audit chain broken at index ${chainBad}`);

    const put = await putBlob(Buffer.from(stamped), {
      mime: "application/pdf",
      filename: `signed-${docMeta.filename}`,
    });

    const [completed] = await db
      .insert(attachment)
      .values({
        accountId: sub.accountId,
        kind: "completed_document",
        blobSha256: put.sha256,
        s3Key: put.s3Key,
        sizeBytes: put.size,
        mime: "application/pdf",
        filename: `signed-${docMeta.filename}`,
        metadata: {
          submissionId,
          originalAttachmentId: att.id,
          documentSha256,
        },
      })
      .returning({ id: attachment.id });
    if (completed) completedAttachmentIds.push(completed.id);
    docHashes.push({ filename: `signed-${docMeta.filename}`, sha256: documentSha256 });
    emailAttachments.push({
      s3Key: put.s3Key,
      filename: `signed-${docMeta.filename}`,
      mime: "application/pdf",
    });
  }

  // Build the platform-signed audit-trail certificate as a SEPARATE document
  // (no certificate page is burned into the signed files). It lists every
  // signed document's hash + the audit chain tail, PAdES-signed by the platform.
  const [latestEvent] = await db
    .select({ hash: auditEvent.hash })
    .from(auditEvent)
    .where(eq(auditEvent.submissionId, submissionId))
    .orderBy(desc(auditEvent.seq))
    .limit(1);
  const finalHash = latestEvent?.hash ?? "";

  const { pdf: auditPdf, signed: auditSigned } = await buildSignedAuditTrail({
    submissionId,
    finalHash,
    documents: docHashes,
    submitters: submitters.map((s) => ({
      name: s.name ?? "",
      email: s.email ?? "",
      completedAt: s.completedAt?.toISOString() ?? "",
      ip: s.ip ?? undefined,
    })),
  });
  const auditPut = await putBlob(Buffer.from(auditPdf), {
    mime: "application/pdf",
    filename: `audit-trail-${submissionId}.pdf`,
  });
  await db.insert(attachment).values({
    accountId: sub.accountId,
    kind: "audit_trail",
    blobSha256: auditPut.sha256,
    s3Key: auditPut.s3Key,
    sizeBytes: auditPut.size,
    mime: "application/pdf",
    filename: `audit-trail-${submissionId}.pdf`,
    metadata: { submissionId, chainHash: finalHash, signed: auditSigned },
  });
  emailAttachments.push({
    s3Key: auditPut.s3Key,
    filename: `audit-trail-${submissionId}.pdf`,
    mime: "application/pdf",
  });

  // AI structured extraction (best-effort — failure shouldn't block completion).
  let extracted: Record<string, unknown> | null = null;
  try {
    const allText = (
      await Promise.all(
        snapshot.documents.map(async (d) => {
          const att = await db.query.attachment.findFirst({
            where: eq(attachment.id, d.attachmentId),
          });
          if (!att) return "";
          const bytes = await getBlob(att.s3Key);
          const pages = await extractPdfText(new Uint8Array(bytes));
          return pages.map((p) => p.text).join("\n\n");
        }),
      )
    ).join("\n\n");

    // Reduce field values to a flat label → value map for the model.
    const labeled: Record<string, string | boolean | number | null> = {};
    for (const f of snapshot.fields) {
      const owner = submitters.find((s) => s.role === f.submitterRole);
      if (!owner) continue;
      const v = (owner.fieldValues as Record<string, unknown> | null)?.[f.id];
      if (v == null) continue;
      const key = f.label ?? `${f.submitterRole}_${f.type}_${f.id.slice(0, 6)}`;
      if (typeof v === "object" && v !== null && "kind" in v && (v as { kind?: string }).kind === "image") {
        labeled[key] = "(signed)";
      } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        labeled[key] = v;
      }
    }

    extracted = await extractStructured({
      accountId: sub.accountId,
      documentText: allText,
      fieldValues: labeled,
    });

    await db
      .update(submission)
      .set({ extractedData: extracted })
      .where(eq(submission.id, submissionId));
  } catch (err) {
    if (!(err instanceof InsufficientBalanceError)) {
      console.warn(`[pdf:stamp] extraction failed for ${submissionId}:`, err);
    }
    // Continue — extraction is best-effort.
  }

  await appendAuditEvent({
    submissionId,
    type: "submission.completed",
    payload: { completedAttachmentIds },
  });

  // Emit submission.completed AFTER stamping + extraction so the payload
  // includes signed document IDs and the extracted data.
  await emitWebhook({
    accountId: sub.accountId,
    event: "submission.completed",
    data: submissionPayload(sub, submitters, {
      completedDocumentIds: completedAttachmentIds,
      extractedData: extracted,
    }),
  });

  // Email the completed document + audit trail to every signer and to the
  // sender (owner). The sender's address is set in Settings, since Agnic only
  // provides a wallet DID. Enqueued as separate jobs so each retries on its own.
  const documentName = snapshot.documents[0]?.filename ?? snapshot.name;
  const recipients: { to: string; name: string | null; toSender: boolean }[] = [];
  for (const s of submitters) {
    if (s.email) recipients.push({ to: s.email, name: s.name, toSender: false });
  }
  const owner = await db.query.account.findFirst({ where: eq(account.id, sub.accountId) });
  if (owner?.email) recipients.push({ to: owner.email, name: owner.name, toSender: true });

  for (const r of recipients) {
    const { subject, html, text } = renderSignedCopyEmail({
      recipientName: r.name,
      documentName,
      toSender: r.toSender,
    });
    await getQueue(Queues.email).add(
      "send",
      { to: r.to, subject, html, text, attachments: emailAttachments },
      { attempts: 5, backoff: { type: "exponential", delay: 30_000 } },
    );
  }

  return { documentIds: completedAttachmentIds };
}

async function collectStampInputs(
  fields: {
    id: string;
    submitterRole: string;
    pageIndex: number;
    x: number;
    y: number;
    w: number;
    h: number;
    type: StampInput["type"];
  }[],
  submitters: Submitter[],
): Promise<StampInput[]> {
  const db = getDb();
  const out: StampInput[] = [];
  for (const f of fields) {
    const owner = submitters.find((s) => s.role === f.submitterRole);
    if (!owner) continue;
    const value = (owner.fieldValues as Record<string, unknown> | null)?.[f.id];
    if (value === undefined || value === null) continue;

    const base = { pageIndex: f.pageIndex, x: f.x, y: f.y, w: f.w, h: f.h, type: f.type };

    if (f.type === "checkbox") {
      out.push({ ...base, checked: Boolean(value) });
      continue;
    }

    if (f.type === "signature" || f.type === "initials") {
      const ref = value as { attachmentId?: string };
      if (ref?.attachmentId) {
        const att = await db.query.attachment.findFirst({
          where: eq(attachment.id, ref.attachmentId),
        });
        if (att) {
          const png = await getBlob(att.s3Key);
          out.push({ ...base, imagePng: new Uint8Array(png) });
        }
      }
      continue;
    }

    out.push({ ...base, text: String(value) });
  }
  return out;
}
