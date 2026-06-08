import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, webhookEndpoint } from "@unisi/db";
import { requireAccount } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const EVENT_NAMES = [
  "submission.created",
  "submitter.opened",
  "submitter.signed",
  "submission.completed",
  "submission.declined",
] as const;

const CreateBody = z.object({
  url: z.string().url(),
  events: z.array(z.enum(EVENT_NAMES)).min(1),
});

export async function GET() {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const rows = await db
    .select({
      id: webhookEndpoint.id,
      url: webhookEndpoint.url,
      events: webhookEndpoint.events,
      active: webhookEndpoint.active,
      createdAt: webhookEndpoint.createdAt,
    })
    .from(webhookEndpoint)
    .where(eq(webhookEndpoint.accountId, auth.accountId))
    .orderBy(desc(webhookEndpoint.createdAt));
  return NextResponse.json({ endpoints: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;
  const parsed = CreateBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const db = getDb();
  const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;
  const [row] = await db
    .insert(webhookEndpoint)
    .values({
      accountId: auth.accountId,
      url: parsed.data.url,
      events: parsed.data.events,
      secret,
    })
    .returning();
  // Return secret ONCE on creation; never expose again on GET.
  return NextResponse.json({ endpoint: row, secret }, { status: 201 });
}
