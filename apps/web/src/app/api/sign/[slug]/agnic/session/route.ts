import { NextResponse } from "next/server";
import { fetchBalance, getValidSignerAccessToken } from "@unisi/agnic";
import { getSignerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Reports whether the signer is signed in with Agnic and, if so, their
 * current wallet balance — surfaced in the signing form's AI panel.
 */
export async function GET() {
  const session = await getSignerSession();
  const token = await getValidSignerAccessToken(session);
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }
  // Persist refreshed tokens back to the cookie (mutated by getValidSignerAccessToken).
  await session.save();
  let balance: number | null = null;
  try {
    balance = await fetchBalance(token);
  } catch {
    balance = null;
  }
  return NextResponse.json({
    authenticated: true,
    balance,
    agnic_subject: session.agnic_subject ?? null,
  });
}

export async function DELETE() {
  const session = await getSignerSession();
  await session.destroy();
  return NextResponse.json({ ok: true });
}
