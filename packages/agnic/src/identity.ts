import crypto from "node:crypto";
import type { AgnicTokens } from "./oauth";

/**
 * Extract a stable Agnic subject identifier from a token-exchange response.
 *
 * Resolution order:
 *   1. `id_token.sub` — OIDC ID token (a JWT). This is the only stable
 *      identifier and the one we want.
 *   2. `access_token.sub` — works only if Agnic ever issues JWT access
 *      tokens. Currently they're opaque (`agnic_…`), so this branch is a
 *      future-proofing no-op.
 *   3. Last-resort SHA-256 of the access token. UNSTABLE — rotates with
 *      the token, creating a new account every login. Logs a warning so
 *      we notice if id_token is missing.
 *
 * No verification is performed: we got the tokens directly from Agnic over
 * TLS at /oauth/token, so we trust the `sub` claim without a JWKS check.
 */
export function extractAgnicSubject(tokens: AgnicTokens): string {
  if (tokens.id_token) {
    const sub = jwtSub(tokens.id_token);
    if (sub) return sub;
  }
  const accessSub = jwtSub(tokens.access_token);
  if (accessSub) return accessSub;

  // eslint-disable-next-line no-console
  console.warn(
    "[agnic] No id_token returned and access_token is opaque — falling back to" +
      " SHA-256 hash of the access token. Subjects will rotate on every login," +
      " creating duplicate account rows. Confirm `openid` scope is granted.",
  );
  return crypto.createHash("sha256").update(tokens.access_token).digest("hex").slice(0, 32);
}

function jwtSub(token: string): string | null {
  const claims = jwtClaims(token);
  return typeof claims?.sub === "string" && (claims.sub as string).length > 0
    ? (claims.sub as string)
    : null;
}

/** Return the decoded payload of a JWT (no signature verification — the
 * token came from Agnic over TLS at /oauth/token, so we trust the claims). */
export function jwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadJson = Buffer.from(parts[1]!, "base64url").toString("utf8");
    return JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extract the email claim from an id_token if present. */
export function extractAgnicEmail(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined;
  const claims = jwtClaims(idToken);
  return typeof claims?.email === "string" ? (claims.email as string) : undefined;
}

/** Extract the name claim from an id_token if present. */
export function extractAgnicName(idToken: string | undefined): string | undefined {
  if (!idToken) return undefined;
  const claims = jwtClaims(idToken);
  if (typeof claims?.name === "string") return claims.name as string;
  if (typeof claims?.given_name === "string") return claims.given_name as string;
  return undefined;
}
