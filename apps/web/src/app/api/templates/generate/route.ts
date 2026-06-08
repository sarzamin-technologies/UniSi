import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, template } from "@unisi/db";
import { requireAccount } from "@/lib/auth-guard";
import { producer, QueueNames } from "@/lib/queues";

export const dynamic = "force-dynamic";

const Body = z.object({
  prompt: z.string().min(1).max(4000),
  name: z.string().optional(),
});

/**
 * Create a placeholder template + enqueue an AI draft job. Returns the
 * template ID so the UI can poll until the worker fills in documents+fields.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const db = getDb();
  const [tpl] = await db
    .insert(template)
    .values({
      accountId: auth.accountId,
      createdBy: auth.accountId,
      name: parsed.data.name ?? "Generating…",
      documents: [],
      submitterRoles: [],
      fields: [],
    })
    .returning();
  if (!tpl) return NextResponse.json({ error: "template_insert_failed" }, { status: 500 });

  await producer(QueueNames.draftTemplate).add(
    "draft",
    { templateId: tpl.id, accountId: auth.accountId, prompt: parsed.data.prompt },
    { attempts: 2, backoff: { type: "exponential", delay: 10_000 } },
  );

  return NextResponse.json({ template: tpl }, { status: 202 });
}
