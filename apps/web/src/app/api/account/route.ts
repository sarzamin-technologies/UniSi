import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, account } from "@unisi/db";
import { requireAccount } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

/**
 * Owner profile. Agnic only returns the wallet DID (no email/name), so the
 * account owner sets their own display name + reply-to email here; the name is
 * used as the "from" identity in signing-invite emails.
 */
const Body = z.object({
  name: z.string().trim().max(120).optional(),
  // Allow clearing by sending an empty string.
  email: z.union([z.string().trim().email().max(200), z.literal("")]).optional(),
});

export async function GET() {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const row = await db.query.account.findFirst({ where: eq(account.id, auth.accountId) });
  return NextResponse.json({ name: row?.name ?? null, email: row?.email ?? null });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const name = parsed.data.name?.trim();
  const email = parsed.data.email?.trim();

  const db = getDb();
  const [row] = await db
    .update(account)
    .set({
      name: name ? name : null,
      email: email ? email : null,
      updatedAt: new Date(),
    })
    .where(eq(account.id, auth.accountId))
    .returning();

  return NextResponse.json({ name: row?.name ?? null, email: row?.email ?? null });
}
