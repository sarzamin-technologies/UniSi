import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, apiToken } from "@unisi/db";
import { requireAccount } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const [row] = await db
    .delete(apiToken)
    .where(and(eq(apiToken.id, params.id), eq(apiToken.accountId, auth.accountId)))
    .returning({ id: apiToken.id });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
