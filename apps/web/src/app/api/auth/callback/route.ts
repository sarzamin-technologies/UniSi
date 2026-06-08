import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  extractAgnicEmail,
  extractAgnicName,
  extractAgnicSubject,
  fetchAgnicUserInfo,
} from "@unisi/agnic";
import { getOwnerSession } from "@/lib/session";
import { upsertAccountFromAgnicLogin } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) return NextResponse.redirect(`${APP_URL}/?error=${encodeURIComponent(error)}`);

  const session = await getOwnerSession();
  if (!code || !session.oauth_state || state !== session.oauth_state || !session.code_verifier) {
    return NextResponse.redirect(`${APP_URL}/?error=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      verifier: session.code_verifier,
      redirectPath: "/api/auth/callback",
    });
    // Resolve identity from three sources, preferring whichever has values.
    // /oauth/userinfo isn't always implemented; the id_token is — with
    // `email profile` scopes it carries the email + name claims directly.
    const userInfo = await fetchAgnicUserInfo(tokens.access_token);
    const agnicSubject = userInfo?.sub ?? extractAgnicSubject(tokens);
    const email = userInfo?.email ?? extractAgnicEmail(tokens.id_token);
    const name = userInfo?.name ?? extractAgnicName(tokens.id_token);
    const accountRow = await upsertAccountFromAgnicLogin({
      agnicSubject,
      email,
      name,
      tokens,
    });

    session.agnic_subject = agnicSubject;
    session.account_id = accountRow.id;
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token;
    session.token_expires_at = Date.now() + tokens.expires_in * 1000;
    session.terms_accepted = accountRow.termsAcceptedAt !== null;
    session.code_verifier = undefined;
    session.oauth_state = undefined;
    await session.save();

    const dest = accountRow.termsAcceptedAt ? "/dashboard" : "/accept-terms";
    return NextResponse.redirect(`${APP_URL}${dest}`);
  } catch (err) {
    console.error("[auth/callback] login failed:", err);
    return NextResponse.redirect(`${APP_URL}/?error=token_exchange_failed`);
  }
}
