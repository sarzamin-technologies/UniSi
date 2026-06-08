import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { buildAuthUrl, generatePkce, generateState } from "@unisi/agnic";
import { getDb, submitter } from "@unisi/db";
import { getSignerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Start the signer-side Agnic OAuth flow. Called from inside the signing form.
 * Tokens land in the signer cookie and pay the signer's own wallet for AI Q&A.
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const db = getDb();
  const sub = await db.query.submitter.findFirst({
    where: eq(submitter.slug, params.slug),
  });
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const session = await getSignerSession();
  const { verifier, challenge } = generatePkce();
  const state = generateState();
  session.code_verifier = verifier;
  session.oauth_state = state;
  session.origin_slug = params.slug;
  await session.save();

  return NextResponse.redirect(
    buildAuthUrl({ challenge, state, redirectPath: "/api/auth/signer-callback" }),
  );
}
