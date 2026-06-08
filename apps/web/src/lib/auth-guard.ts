import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, apiToken } from "@unisi/db";
import { getOwnerSession } from "./session";
import { hashToken } from "./api-token";

/**
 * Resolve the signed-in account ID, returning a 401 NextResponse if missing.
 * Use at the top of every owner-only API route.
 */
export async function requireAccount(): Promise<{ accountId: string } | NextResponse> {
  const session = await getOwnerSession();
  if (!session.account_id || !session.access_token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!session.terms_accepted) {
    return NextResponse.json({ error: "terms_not_accepted" }, { status: 403 });
  }
  return { accountId: session.account_id };
}

/**
 * Dual auth: accept either an iron-session cookie (browser) OR an
 * `Authorization: Bearer unisi_...` header (programmatic). Same shape as
 * `requireAccount` so call sites are interchangeable.
 *
 * Use this for endpoints that should be reachable from both the dashboard
 * and external integrations (templates, submissions, attachments).
 */
export async function requireAccountOrToken(
  req: NextRequest,
): Promise<{ accountId: string; via: "session" | "token" } | NextResponse> {
  // Bearer header wins if present — typical for SDK clients.
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(unisi_[A-Za-z0-9_-]+)$/.exec(auth);
  if (m) {
    const hash = hashToken(m[1]!);
    const db = getDb();
    const row = await db.query.apiToken.findFirst({ where: eq(apiToken.tokenHash, hash) });
    if (!row) return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    // Best-effort last-used timestamp.
    db.update(apiToken)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiToken.id, row.id))
      .catch(() => undefined);
    return { accountId: row.accountId, via: "token" };
  }

  const sessionResult = await requireAccount();
  if (sessionResult instanceof NextResponse) return sessionResult;
  return { accountId: sessionResult.accountId, via: "session" };
}
