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

const html = (body: string) =>
  new NextResponse(`<!DOCTYPE html><html><body><script>${body}</script></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

const fail = (msg: string) =>
  html(
    `try{window.opener.postMessage({type:"agnic-oauth-result",success:false,error:${JSON.stringify(msg)}},"*");}catch(e){}window.close();`,
  );

const succeed = (appUrl: string, termsPending = false) =>
  html(
    termsPending
      ? `try{window.opener.postMessage({type:"agnic-oauth-result",success:true,terms_pending:true},"*");window.close();}catch(e){window.location.href=${JSON.stringify(appUrl + "/accept-terms")};}`
      : `try{window.opener.postMessage({type:"agnic-oauth-result",success:true},"*");window.close();}catch(e){window.location.href=${JSON.stringify(appUrl + "/dashboard")};}`,
  );

export async function GET(req: NextRequest) {
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const session = await getOwnerSession();
  if (!code || !session.oauth_state || state !== session.oauth_state || !session.code_verifier) {
    return fail("invalid_state");
  }

  try {
    const tokens = await exchangeCodeForTokens({
      code,
      verifier: session.code_verifier,
      redirectPath: "/api/auth/popup-callback",
    });
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

    return succeed(APP_URL, accountRow.termsAcceptedAt === null);
  } catch {
    return fail("token_exchange_failed");
  }
}
