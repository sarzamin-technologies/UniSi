import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { exchangeCodeForTokens, extractAgnicSubject } from "@unisi/agnic";
import { getDb, submitter, submitterAgnic } from "@unisi/db";
import { appendAuditEvent } from "@unisi/audit";
import { getSignerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Completes signer-side OAuth. Persists tokens to the signer cookie (NOT the
 * database) and links the verified Agnic subject to the submitter for the
 * audit trail.
 */
export async function GET(req: NextRequest) {
  const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const session = await getSignerSession();
  const slug = session.origin_slug;

  const fail = (msg: string) =>
    NextResponse.redirect(
      `${APP_URL}/sign/${slug ?? ""}?agnic_error=${encodeURIComponent(msg)}`,
    );

  if (error) return fail(error);
  if (!slug) return NextResponse.redirect(`${APP_URL}/`);
  if (!code || !session.oauth_state || state !== session.oauth_state || !session.code_verifier) {
    return fail("invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      verifier: session.code_verifier,
      redirectPath: "/api/auth/signer-callback",
    });
    const agnicSubject = extractAgnicSubject(tokens);

    session.agnic_subject = agnicSubject;
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token;
    session.token_expires_at = Date.now() + tokens.expires_in * 1000;
    session.code_verifier = undefined;
    session.oauth_state = undefined;
    await session.save();

    // Link to submitter for stronger audit non-repudiation.
    const db = getDb();
    const sub = await db.query.submitter.findFirst({ where: eq(submitter.slug, slug) });
    if (sub) {
      await db
        .insert(submitterAgnic)
        .values({ submitterId: sub.id, agnicSubject })
        .onConflictDoUpdate({
          target: submitterAgnic.submitterId,
          set: { agnicSubject, lastSeenAt: new Date() },
        });
      await appendAuditEvent({
        submissionId: sub.submissionId,
        submitterId: sub.id,
        type: "submitter.agnic_linked",
        payload: { agnicSubject },
      });
    }

    return NextResponse.redirect(`${APP_URL}/sign/${slug}?agnic=ok`);
  } catch {
    return fail("token_exchange_failed");
  }
}
