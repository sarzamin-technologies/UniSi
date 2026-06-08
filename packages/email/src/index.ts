import nodemailer, { type Transporter } from "nodemailer";

let _transport: Transporter | undefined;

function transport(): Transporter {
  if (_transport) return _transport;

  // Resend has a drop-in SMTP relay (smtp.resend.com:465) so we use a single
  // SMTP transport for both dev (Mailpit) and prod (Resend SMTP).
  // To use Resend SMTP, set:
  //   SMTP_HOST=smtp.resend.com  SMTP_PORT=465  SMTP_USER=resend  SMTP_PASS=<RESEND_API_KEY>
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  _transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  return _transport;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const from = process.env.SMTP_FROM ?? "UniSi <noreply@unisi.local>";
  await transport().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
    attachments: input.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}

export function renderSigningInvite(opts: {
  signerName?: string | null;
  senderName?: string | null;
  documentName: string;
  signingUrl: string;
}): { subject: string; html: string; text: string } {
  const greeting = opts.signerName ? `Hi ${opts.signerName},` : "Hello,";
  const sender = opts.senderName ?? "Someone";
  const subject = `${sender} has requested your signature: ${opts.documentName}`;
  const text = `${greeting}\n\n${sender} has asked you to review and sign "${opts.documentName}".\n\nOpen this link to begin:\n${opts.signingUrl}\n\nIf you have questions, you can ask them in the document with our AI assistant — sign in with Agnic to use it; the first $5 is free.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 16px;">${escape(sender)} has requested your signature</h2>
      <p>${escape(greeting)}</p>
      <p>${escape(sender)} has asked you to review and sign <strong>${escape(opts.documentName)}</strong>.</p>
      <p style="margin: 32px 0;">
        <a href="${opts.signingUrl}"
           style="background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Review & sign
        </a>
      </p>
      <p style="color: #71717a; font-size: 14px;">
        Have questions about the document? Sign in with Agnic from the signing page to ask our AI assistant — the first $5 is on the house.
      </p>
    </div>
  `;
  return { subject, html, text };
}

export function renderSignedCopyEmail(opts: {
  recipientName?: string | null;
  documentName: string;
  /** true → message addressed to the sender/owner; false → to a signer. */
  toSender: boolean;
}): { subject: string; html: string; text: string } {
  const greeting = opts.recipientName ? `Hi ${opts.recipientName},` : "Hello,";
  const subject = `Completed & signed: ${opts.documentName}`;
  const lead = opts.toSender
    ? `All parties have signed <strong>${escape(opts.documentName)}</strong>. The completed document is attached, along with its audit trail.`
    : `<strong>${escape(opts.documentName)}</strong> has been fully signed by all parties. Your signed copy is attached, along with the audit trail.`;
  const leadText = opts.toSender
    ? `All parties have signed "${opts.documentName}". The completed document and its audit trail are attached.`
    : `"${opts.documentName}" has been fully signed by all parties. Your signed copy and its audit trail are attached.`;
  const text = `${greeting}\n\n${leadText}\n\nKeep these files for your records.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 16px;">Signing complete</h2>
      <p>${escape(greeting)}</p>
      <p>${lead}</p>
      <p style="color: #71717a; font-size: 14px; margin-top: 24px;">
        Two files are attached: the signed document and a tamper-evident audit trail.
        Keep them for your records.
      </p>
    </div>
  `;
  return { subject, html, text };
}

export function renderProgressEmail(opts: {
  recipientName?: string | null;
  documentName: string;
  signerName: string;
  signerRole: string;
  signedCount: number;
  totalCount: number;
}): { subject: string; html: string; text: string } {
  const greeting = opts.recipientName ? `Hi ${opts.recipientName},` : "Hello,";
  const who = `${opts.signerName} (${opts.signerRole})`;
  const progress = `${opts.signedCount} of ${opts.totalCount} have signed`;
  const subject = `${opts.signerName} signed: ${opts.documentName}`;
  const text = `${greeting}\n\n${who} just signed "${opts.documentName}". ${progress}.\n\nYou'll get the completed document once everyone has signed.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 16px;">A signer just completed</h2>
      <p>${escape(greeting)}</p>
      <p><strong>${escape(who)}</strong> just signed <strong>${escape(opts.documentName)}</strong>.</p>
      <p style="font-weight: 600; color: #047857;">${escape(progress)}.</p>
      <p style="color: #71717a; font-size: 14px;">
        You'll receive the completed document and audit trail once everyone has signed.
      </p>
    </div>
  `;
  return { subject, html, text };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
