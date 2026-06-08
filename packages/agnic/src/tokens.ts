/**
 * Two strictly separate token chokepoints — see PLAN.md risk #4.
 *
 *   getValidOwnerAccessToken(accountId)  → owner-side AI (worker jobs, no browser)
 *   getValidSignerAccessToken(session)   → signer-side AI (request-time, cookie-only)
 *
 * The OwnerToken / SignerToken branded types make it a compile-time error to
 * pass one where the other is expected.
 */
import { eq } from "drizzle-orm";
import {
  accountAgnicCreds,
  encryptString,
  decryptString,
  getDb,
} from "@unisi/db";
import { refreshAccessToken } from "./oauth";
import type { SignerSessionData } from "./session";

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

export type OwnerToken = string & { readonly __brand: "OwnerToken" };
export type SignerToken = string & { readonly __brand: "SignerToken" };

// ---------- Owner ----------

export async function persistOwnerTokens(
  accountId: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
): Promise<void> {
  const db = getDb();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const accessTokenEnc = await encryptString(tokens.access_token);
  const refreshTokenEnc = await encryptString(tokens.refresh_token);
  await db
    .insert(accountAgnicCreds)
    .values({
      accountId,
      accessTokenEnc,
      refreshTokenEnc,
      expiresAt,
      needsReauth: false,
    })
    .onConflictDoUpdate({
      target: accountAgnicCreds.accountId,
      set: { accessTokenEnc, refreshTokenEnc, expiresAt, needsReauth: false, updatedAt: new Date() },
    });
}

/** Fetch the owner's access token, refreshing if near expiry. Throws if reauth required. */
export async function getValidOwnerAccessToken(accountId: string): Promise<OwnerToken> {
  const db = getDb();
  const row = await db.query.accountAgnicCreds.findFirst({
    where: eq(accountAgnicCreds.accountId, accountId),
  });
  if (!row) throw new OwnerReauthRequired(accountId, "no_credentials");
  if (row.needsReauth) throw new OwnerReauthRequired(accountId, "marked_needs_reauth");

  const needsRefresh = row.expiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;
  if (!needsRefresh) {
    const access = await decryptString(row.accessTokenEnc);
    return access as OwnerToken;
  }

  const refreshToken = await decryptString(row.refreshTokenEnc);
  let next;
  try {
    next = await refreshAccessToken(refreshToken);
  } catch (err) {
    await db
      .update(accountAgnicCreds)
      .set({ needsReauth: true, updatedAt: new Date() })
      .where(eq(accountAgnicCreds.accountId, accountId));
    throw new OwnerReauthRequired(accountId, "refresh_failed", { cause: err });
  }
  await persistOwnerTokens(accountId, next);
  return next.access_token as OwnerToken;
}

export class OwnerReauthRequired extends Error {
  constructor(
    public readonly accountId: string,
    public readonly reason: "no_credentials" | "marked_needs_reauth" | "refresh_failed",
    options?: ErrorOptions,
  ) {
    super(`Owner reauth required for account ${accountId}: ${reason}`, options);
    this.name = "OwnerReauthRequired";
  }
}

// ---------- Signer ----------

/**
 * Pull a usable signer access token straight from the iron-session payload.
 * If the token is near expiry, refresh in-process and mutate the session
 * so the caller can persist the updated cookie.
 */
export async function getValidSignerAccessToken(
  session: SignerSessionData,
): Promise<SignerToken | null> {
  if (!session.access_token) return null;

  const needsRefresh =
    !session.token_expires_at ||
    session.token_expires_at - Date.now() < REFRESH_BUFFER_MS;

  if (!needsRefresh) return session.access_token as SignerToken;

  if (!session.refresh_token) return null;

  try {
    const next = await refreshAccessToken(session.refresh_token);
    session.access_token = next.access_token;
    session.refresh_token = next.refresh_token;
    session.token_expires_at = Date.now() + next.expires_in * 1000;
    return next.access_token as SignerToken;
  } catch {
    // Caller should treat null as "signer needs to re-link" and surface the CTA.
    session.access_token = undefined;
    session.refresh_token = undefined;
    session.token_expires_at = undefined;
    return null;
  }
}
