import { NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOwnerSession();
  return NextResponse.json({
    authenticated: Boolean(session.account_id && session.access_token),
    account_id: session.account_id ?? null,
    terms_accepted: session.terms_accepted ?? false,
  });
}

export async function DELETE() {
  const session = await getOwnerSession();
  await session.destroy();
  return NextResponse.json({ ok: true });
}
