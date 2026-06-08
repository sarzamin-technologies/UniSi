import { NextResponse } from "next/server";
import { fetchBalance, getValidOwnerAccessToken, OwnerReauthRequired } from "@unisi/agnic";
import { getOwnerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOwnerSession();
  if (!session.account_id) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const token = await getValidOwnerAccessToken(session.account_id);
    const balance = await fetchBalance(token);
    return NextResponse.json({ balance });
  } catch (err) {
    if (err instanceof OwnerReauthRequired) {
      return NextResponse.json({ error: "reauth_required" }, { status: 401 });
    }
    return NextResponse.json({ error: "balance_fetch_failed" }, { status: 500 });
  }
}
