/**
 * Two distinct iron-session cookies:
 *
 *   1. OWNER session — long-lived, app-wide. Holds the account-owner's Agnic tokens
 *      for UI use. The same tokens are *also* persisted encrypted in
 *      `account_agnic_creds` so worker jobs can refresh them without a browser.
 *
 *   2. SIGNER session — separate cookie used only inside the signing form.
 *      Holds the signer's own Agnic tokens for AI Q&A. Pays from signer's own
 *      wallet. Not persisted to the database (one-shot use).
 *
 * Keeping them in different cookies prevents a signer's tokens from being
 * mistaken for an owner's at the type or runtime level.
 */
import type { SessionOptions } from "iron-session";

function sessionPassword(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

export interface OwnerSessionData {
  /** Agnic OAuth subject (stable across logins). Identifies the account. */
  agnic_subject?: string;
  /** Internal account UUID once we have one. */
  account_id?: string;
  /** Access token mirror for UI use. Truth lives in account_agnic_creds. */
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number; // ms epoch
  /** True once the account owner has accepted the Terms of Service. */
  terms_accepted?: boolean;
  // Transient — cleared after callback completes.
  code_verifier?: string;
  oauth_state?: string;
}

export interface SignerSessionData {
  /** Agnic OAuth subject for the signer. */
  agnic_subject?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number;
  /** Slug the signer initiated the OAuth flow from — for return-to-signing-form. */
  origin_slug?: string;
  // Transient.
  code_verifier?: string;
  oauth_state?: string;
}

export function ownerSessionOptions(): SessionOptions {
  return {
    cookieName: "unisi_owner",
    password: sessionPassword(),
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 90, // 90 days, matches Agnic refresh-token lifetime
      path: "/",
    },
  };
}

export function signerSessionOptions(): SessionOptions {
  return {
    cookieName: "unisi_signer",
    password: sessionPassword(),
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    },
  };
}
