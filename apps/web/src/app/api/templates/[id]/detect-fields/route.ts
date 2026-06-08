import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, template } from "@unisi/db";
import { requireAccount } from "@/lib/auth-guard";
import { producer, QueueNames } from "@/lib/queues";

export const dynamic = "force-dynamic";

const Body = z
  .object({
    replace: z.boolean().optional(),
  })
  .optional();

/** Enqueue an AI field-detection job for this template. Owner pays. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;
  const body = Body.parse(await req.json().catch(() => ({})));

  const db = getDb();
  const tpl = await db.query.template.findFirst({
    where: and(eq(template.id, params.id), eq(template.accountId, auth.accountId)),
  });
  if (!tpl) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const job = await producer(QueueNames.detectFields).add(
    "detect",
    { templateId: tpl.id, accountId: auth.accountId, replace: body?.replace ?? false },
    { attempts: 2, backoff: { type: "exponential", delay: 5_000 } },
  );

  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
