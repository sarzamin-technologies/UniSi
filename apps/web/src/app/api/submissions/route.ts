import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, template, submission, submitter, account } from "@unisi/db";
import { appendAuditEvent } from "@unisi/audit";
import { renderSigningInvite } from "@unisi/email";
import { requireAccountOrToken } from "@/lib/auth-guard";
import { newSubmitterSlug } from "@/lib/slug";
import { producer, QueueNames } from "@/lib/queues";
import { emitWebhook, submissionPayload } from "@/lib/webhooks";

export const dynamic = "force-dynamic";

const CreateSubmissionBody = z.object({
  templateId: z.string().uuid(),
  submitters: z
    .array(
      z.object({
        role: z.string().min(1),
        email: z.string().email(),
        name: z.string().optional(),
      }),
    )
    .min(1),
});

export async function GET(req: NextRequest) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const rows = await db
    .select({
      id: submission.id,
      status: submission.status,
      createdAt: submission.createdAt,
      completedAt: submission.completedAt,
      templateId: submission.templateId,
    })
    .from(submission)
    .where(eq(submission.accountId, auth.accountId))
    .orderBy(desc(submission.createdAt))
    .limit(100);
  return NextResponse.json({ submissions: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const body = CreateSubmissionBody.safeParse(await req.json());
  if (!body.success) {
    const issues = body.error.issues;
    const error = issues.some((i) => i.path.includes("email"))
      ? "Please enter a valid email address for every signer."
      : "invalid_body";
    return NextResponse.json({ error, issues }, { status: 400 });
  }
  const db = getDb();

  const tpl = await db.query.template.findFirst({
    where: and(eq(template.id, body.data.templateId), eq(template.accountId, auth.accountId)),
  });
  if (!tpl) return NextResponse.json({ error: "template_not_found" }, { status: 404 });

  const acct = await db.query.account.findFirst({ where: eq(account.id, auth.accountId) });

  const [sub] = await db
    .insert(submission)
    .values({
      accountId: auth.accountId,
      templateId: tpl.id,
      status: "pending",
      templateSnapshot: {
        name: tpl.name,
        documents: tpl.documents,
        fields: tpl.fields,
        submitterRoles: tpl.submitterRoles,
      },
    })
    .returning();
  if (!sub) return NextResponse.json({ error: "submission_insert_failed" }, { status: 500 });

  const submitterRows = await db
    .insert(submitter)
    .values(
      body.data.submitters.map((s) => ({
        submissionId: sub.id,
        role: s.role,
        slug: newSubmitterSlug(),
        email: s.email,
        name: s.name ?? null,
        status: "pending" as const,
      })),
    )
    .returning();

  await appendAuditEvent({
    submissionId: sub.id,
    type: "submission.created",
    payload: {
      templateId: tpl.id,
      submitters: submitterRows.map((s) => ({ id: s.id, role: s.role, email: s.email })),
    },
  });

  await emitWebhook({
    accountId: auth.accountId,
    event: "submission.created",
    data: submissionPayload(sub, submitterRows),
  });

  // Enqueue invitation emails. URL points to the public signing page.
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const docs = tpl.documents as { filename?: string }[];
  const documentName = docs[0]?.filename ?? tpl.name;
  for (const s of submitterRows) {
    if (!s.email) continue;
    const signingUrl = `${appUrl}/sign/${s.slug}`;
    const { subject, html, text } = renderSigningInvite({
      signerName: s.name,
      senderName: acct?.name ?? acct?.email ?? null,
      documentName,
      signingUrl,
    });
    await producer(QueueNames.email).add(
      "send",
      { to: s.email, subject, html, text, replyTo: acct?.email ?? undefined, submitterId: s.id },
      { attempts: 5, backoff: { type: "exponential", delay: 30_000 } },
    );
  }

  return NextResponse.json({ submission: sub, submitters: submitterRows }, { status: 201 });
}
