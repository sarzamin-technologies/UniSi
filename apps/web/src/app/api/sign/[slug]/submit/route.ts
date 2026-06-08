import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, submitter, submission, attachment, account } from "@unisi/db";
import { putBlob } from "@unisi/storage";
import { appendAuditEvent } from "@unisi/audit";
import { renderProgressEmail } from "@unisi/email";
import { producer, QueueNames } from "@/lib/queues";
import { emitWebhook, submissionPayload } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

const FieldValueSchema = z.union([
  z.string(),
  z.boolean(),
  z.object({
    /** PNG data URL: data:image/png;base64,…  */
    dataUrl: z.string().startsWith("data:image/png;base64,"),
  }),
]);

const SubmitBody = z.object({
  values: z.record(z.string(), FieldValueSchema),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const db = getDb();
  const sub = await db.query.submitter.findFirst({ where: eq(submitter.slug, params.slug) });
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (sub.status === "completed") {
    return NextResponse.json({ error: "already_completed" }, { status: 409 });
  }

  const parsed = SubmitBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const parent = await db.query.submission.findFirst({
    where: eq(submission.id, sub.submissionId),
  });
  if (!parent) return NextResponse.json({ error: "submission_missing" }, { status: 500 });

  // For signature/initials values we receive a base64 PNG — persist as
  // attachments and replace the in-band data with an attachment reference so
  // the field_values JSONB stays small.
  const persistedValues: Record<string, unknown> = {};
  const signatureAttachmentIds: string[] = [];
  for (const [fieldId, raw] of Object.entries(parsed.data.values)) {
    if (typeof raw === "object" && raw !== null && "dataUrl" in raw) {
      const base64 = raw.dataUrl.replace(/^data:image\/png;base64,/, "");
      const buf = Buffer.from(base64, "base64");
      const put = await putBlob(buf, { mime: "image/png" });
      const [att] = await db
        .insert(attachment)
        .values({
          accountId: parent.accountId,
          kind: "field_attachment",
          blobSha256: put.sha256,
          s3Key: put.s3Key,
          sizeBytes: put.size,
          mime: "image/png",
        })
        .returning({ id: attachment.id });
      if (att) {
        signatureAttachmentIds.push(att.id);
        persistedValues[fieldId] = { attachmentId: att.id, kind: "image" };
      }
    } else {
      persistedValues[fieldId] = raw;
    }
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = req.headers.get("user-agent") ?? null;
  const now = new Date();

  await db
    .update(submitter)
    .set({
      fieldValues: persistedValues,
      status: "completed",
      completedAt: now,
      ip: ip ?? sub.ip,
      ua: ua ?? sub.ua,
    })
    .where(eq(submitter.id, sub.id));

  await appendAuditEvent({
    submissionId: sub.submissionId,
    submitterId: sub.id,
    type: "submitter.signed",
    payload: {
      ip,
      ua,
      fieldCount: Object.keys(persistedValues).length,
      signatureAttachmentIds,
    },
  });

  const others = await db
    .select({ status: submitter.status })
    .from(submitter)
    .where(eq(submitter.submissionId, sub.submissionId));
  const allDone = others.every((r) => r.status === "completed");

  // Re-fetch the submitter to get the freshly updated row for the webhook payload.
  const allSubmitters = await db
    .select()
    .from(submitter)
    .where(eq(submitter.submissionId, sub.submissionId));

  await emitWebhook({
    accountId: parent.accountId,
    event: "submitter.signed",
    data: submissionPayload(parent, allSubmitters),
  });

  if (allDone) {
    await db
      .update(submission)
      .set({ status: "completed", completedAt: now })
      .where(eq(submission.id, sub.submissionId));

    // submission.completed webhook is emitted by the worker AFTER stamping
    // and AI extraction so the payload carries signed document IDs and
    // extracted_data.
    await producer(QueueNames.pdfStamp).add(
      "stamp",
      { submissionId: sub.submissionId },
      { attempts: 5, backoff: { type: "exponential", delay: 10_000 } },
    );
  } else {
    // Not everyone has signed yet — send the sender a progress update.
    // (The final signer triggers the completion email from the stamp worker.)
    const owner = await db.query.account.findFirst({
      where: eq(account.id, parent.accountId),
    });
    if (owner?.email) {
      const snap = parent.templateSnapshot as {
        name: string;
        documents?: { filename: string }[];
      };
      const documentName = snap.documents?.[0]?.filename ?? snap.name;
      const signedCount = allSubmitters.filter((s) => s.status === "completed").length;
      const { subject, html, text } = renderProgressEmail({
        recipientName: owner.name,
        documentName,
        signerName: sub.name ?? sub.email ?? sub.role,
        signerRole: sub.role,
        signedCount,
        totalCount: allSubmitters.length,
      });
      await producer(QueueNames.email).add(
        "send",
        { to: owner.email, subject, html, text },
        { attempts: 5, backoff: { type: "exponential", delay: 30_000 } },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
