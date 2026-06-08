import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, apiToken } from "@unisi/db";
import { requireAccount } from "@/lib/auth-guard";
import { newApiToken } from "@/lib/api-token";

export const dynamic = "force-dynamic";

const Body = z.object({ name: z.string().min(1).max(100) });

export async function GET() {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const rows = await db
    .select({
      id: apiToken.id,
      name: apiToken.name,
      createdAt: apiToken.createdAt,
      lastUsedAt: apiToken.lastUsedAt,
    })
    .from(apiToken)
    .where(eq(apiToken.accountId, auth.accountId))
    .orderBy(desc(apiToken.createdAt));
  return NextResponse.json({ tokens: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const db = getDb();
  const { plaintext, hash } = newApiToken();
  const [row] = await db
    .insert(apiToken)
    .values({ accountId: auth.accountId, name: parsed.data.name, tokenHash: hash })
    .returning({ id: apiToken.id, name: apiToken.name, createdAt: apiToken.createdAt });
  if (!row) return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  // Plaintext is shown ONCE — never recoverable from the database.
  return NextResponse.json({ token: { ...row, plaintext } }, { status: 201 });
}
