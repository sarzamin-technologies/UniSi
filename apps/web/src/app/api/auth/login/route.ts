import { NextResponse } from "next/server";
import { buildAuthUrl, generatePkce, generateState } from "@unisi/agnic";
import { getOwnerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getOwnerSession();
  const { verifier, challenge } = generatePkce();
  const state = generateState();
  session.code_verifier = verifier;
  session.oauth_state = state;
  await session.save();
  return NextResponse.redirect(
    buildAuthUrl({ challenge, state, redirectPath: "/api/auth/callback" }),
  );
}
