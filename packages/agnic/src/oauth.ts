import crypto from "node:crypto";
import { AGNIC_API_BASE, REQUIRED_SCOPES, appUrl, clientId, clientSecret } from "./config";

export type RedirectPath =
  | "/api/auth/callback"
  | "/api/auth/popup-callback"
  | "/api/auth/signer-callback";

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface AgnicTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  /** OIDC id_token — present when `openid` scope is granted. Carries the
   * stable `sub` claim we use as account identity. */
  id_token?: string;
}

/** RFC 7636 PKCE: 32-byte verifier + S256 challenge. */
export function generatePkce(): PkcePair {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/** CSRF state parameter — 16 random bytes hex-encoded. */
export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthUrl(opts: {
  challenge: string;
  state: string;
  redirectPath: RedirectPath;
  scopes?: string;
}): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: `${appUrl()}${opts.redirectPath}`,
    response_type: "code",
    scope: opts.scopes ?? REQUIRED_SCOPES,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
    state: opts.state,
  });
  return `${AGNIC_API_BASE}/oauth/authorize?${params.toString()}`;
}

function withSecret(params: URLSearchParams): URLSearchParams {
  const secret = clientSecret();
  if (secret) params.set("client_secret", secret);
  return params;
}

export async function exchangeCodeForTokens(opts: {
  code: string;
  verifier: string;
  redirectPath: RedirectPath;
}): Promise<AgnicTokens> {
  const body = withSecret(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId(),
      code: opts.code,
      code_verifier: opts.verifier,
      redirect_uri: `${appUrl()}${opts.redirectPath}`,
    }),
  );
  const res = await fetch(`${AGNIC_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agnic token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as AgnicTokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<AgnicTokens> {
  const body = withSecret(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId(),
      refresh_token: refreshToken,
    }),
  );
  const res = await fetch(`${AGNIC_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agnic token refresh failed: ${res.status} ${text}`);
  }
  return (await res.json()) as AgnicTokens;
}
