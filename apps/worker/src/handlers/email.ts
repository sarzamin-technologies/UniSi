import type { Job } from "bullmq";
import { sendEmail, type EmailAttachment } from "@unisi/email";
import { getBlob } from "@unisi/storage";

interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  submitterId?: string;
  /** Attachments referenced by storage key — fetched here so job payloads stay small. */
  attachments?: { s3Key: string; filename: string; mime?: string }[];
}

export async function emailHandler(job: Job<EmailJobData>): Promise<void> {
  let attachments: EmailAttachment[] | undefined;
  if (job.data.attachments?.length) {
    attachments = await Promise.all(
      job.data.attachments.map(async (a) => ({
        filename: a.filename,
        content: await getBlob(a.s3Key),
        contentType: a.mime,
      })),
    );
  }

  await sendEmail({
    to: job.data.to,
    subject: job.data.subject,
    html: job.data.html,
    text: job.data.text,
    replyTo: job.data.replyTo,
    attachments,
  });
}
