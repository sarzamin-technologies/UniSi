/**
 * Standard OpenID-Connect /oauth/userinfo lookup. Requires the `openid` scope
 * to be granted on the access token.
 *
 * Returns the durable identifiers we need to key + display an account:
 *   - `sub`   — DID (e.g. `did:privy:…`). Stable across logins. Becomes
 *               our `account.agnic_subject`.
 *   - `email` — human-readable identifier. Saved on `account.email`.
 *
 * Failing soft on this endpoint is fine — callers can fall back to id_token
 * decoding via {@link extractAgnicSubject}.
 */
import { AGNIC_API_BASE } from "./config";

export interface AgnicUserInfo {
  sub: string;
  email?: string;
  name?: string;
}

export async function fetchAgnicUserInfo(accessToken: string): Promise<AgnicUserInfo | null> {
  // Try the OIDC-standard path first, then a couple of likely Agnic-specific
  // fallbacks. Whichever returns first wins.
  const candidates = ["/oauth/userinfo", "/api/userinfo", "/api/me"];
  for (const path of candidates) {
    try {
      const res = await fetch(`${AGNIC_API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as Record<string, unknown>;
      const sub = typeof body.sub === "string" ? body.sub : null;
      if (!sub) continue;
      return {
        sub,
        email: typeof body.email === "string" ? body.email : undefined,
        name: typeof body.name === "string" ? body.name : undefined,
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}
