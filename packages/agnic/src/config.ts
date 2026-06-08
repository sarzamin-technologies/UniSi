export const AGNIC_API_BASE = process.env.AGNIC_API_BASE ?? "https://api.agnic.ai";
export const AGNIC_AUTH_URL =
  process.env.NEXT_PUBLIC_AGNIC_AUTH_URL ?? "https://app.agnic.ai";
export const AGNIC_TOPUP_URL =
  process.env.NEXT_PUBLIC_AGNIC_TOPUP_URL ?? "https://app.agnic.ai/topup";

/**
 * Scopes we request on every OAuth flow.
 *
 *   openid          — return an id_token (JWT) carrying a stable `sub` claim
 *   email           — include the user's email in id_token + userinfo
 *   profile         — include name + other basic profile fields
 *   payments:sign   — bill the user's wallet for AI gateway calls
 *   balance:read    — display wallet balance in the UI
 */
export const REQUIRED_SCOPES =
  "openid email profile payments:sign balance:read" as const;

export function clientId(): string {
  const id = process.env.AGNIC_OAUTH_CLIENT_ID;
  if (!id) throw new Error("AGNIC_OAUTH_CLIENT_ID is not set");
  return id;
}

export function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return url.replace(/\/$/, "");
}

/**
 * The Partner ID issued in the Agnic portal. The public docs show
 * `partner_xxx` as an example placeholder, but the actual issued value can
 * be a Privy DID (`did:privy:…`). Forward whatever the user configured
 * verbatim — Agnic accepts both.
 */
export function partnerId(): string | undefined {
  const raw = process.env.AGNIC_PARTNER_ID;
  return raw && raw.length > 0 ? raw : undefined;
}

/**
 * Optional client secret. Per the Agnic guide PKCE alone suffices for public
 * clients, but if your registered client is confidential the secret is sent
 * alongside client_id in the token exchange.
 */
export function clientSecret(): string | undefined {
  const s = process.env.AGNIC_OAUTH_CLIENT_SECRET;
  return s && s.length > 0 ? s : undefined;
}

/**
 * Merchant trio. Agnic OAuth clients with a merchant association mint access
 * tokens whose claims the gateway validates by demanding `X-Merchant-Id`,
 * `X-Merchant-Wallet`, and `X-Merchant-Fee-Percent` together. If any are
 * missing the gateway 400s with `invalid_merchant_headers`. We attach all
 * three only when all three env vars are set; otherwise none.
 */
export interface MerchantHeaders {
  "X-Merchant-Id": string;
  "X-Merchant-Wallet": string;
  "X-Merchant-Fee-Percent": string;
}
export function merchantHeaders(): MerchantHeaders | undefined {
  const id = process.env.AGNIC_MERCHANT_ID;
  const wallet = process.env.AGNIC_MERCHANT_WALLET;
  const fee = process.env.AGNIC_MERCHANT_FEE_PERCENT;
  if (id && wallet && fee) {
    return {
      "X-Merchant-Id": id,
      "X-Merchant-Wallet": wallet,
      "X-Merchant-Fee-Percent": String(fee),
    };
  }
  return undefined;
}
