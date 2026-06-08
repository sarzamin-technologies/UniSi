import OpenAI from "openai";
import { AGNIC_API_BASE, partnerId, merchantHeaders } from "@unisi/agnic";
import type { OwnerToken, SignerToken } from "@unisi/agnic";

/**
 * Build an OpenAI SDK client pointed at the Agnic gateway.
 *
 * Attribution headers (X-Partner-Id + the X-Merchant-* trio) describe the
 * integrator (us), not the bearer — so they go on every request, owner-side
 * or signer-side. Confirmed empirically: the gateway treats X-Partner-Id
 * with a DID-format value as a merchant signal and demands the merchant
 * trio whenever it's set, so if AGNIC_PARTNER_ID is configured the merchant
 * trio must be configured too.
 *
 * The `kind` argument is informational only — kept so call sites can label
 * which billing context (owner vs signer) a call belongs to for logging.
 *
 * When AGNIC_DEBUG=1 we wrap fetch to log the outbound URL + headers (with
 * Authorization redacted) and the full response body on non-2xx.
 */
export function createAgnicClient(
  accessToken: OwnerToken | SignerToken,
  _opts: { kind: "owner" | "signer" } = { kind: "owner" },
): OpenAI {
  const defaultHeaders: Record<string, string> = {};
  const pid = partnerId();
  if (pid) defaultHeaders["X-Partner-Id"] = pid;
  const merchant = merchantHeaders();
  if (merchant) Object.assign(defaultHeaders, merchant);
  return new OpenAI({
    apiKey: accessToken,
    baseURL: `${AGNIC_API_BASE}/v1`,
    defaultHeaders,
    fetch: process.env.AGNIC_DEBUG === "1" ? debugFetch : undefined,
  });
}

const debugFetch: typeof fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;
  const method = init?.method ?? (input instanceof Request ? input.method : "GET");
  const sent = headersToObject(init?.headers);
  // eslint-disable-next-line no-console
  console.log("[agnic→]", method, url);
  // eslint-disable-next-line no-console
  console.log("[agnic→ headers]", redactAuth(sent));
  const res = await fetch(input, init);
  if (!res.ok) {
    const cloned = res.clone();
    const body = await cloned.text().catch(() => "<unreadable>");
    // eslint-disable-next-line no-console
    console.log("[agnic←]", res.status, res.statusText, "body=", body.slice(0, 2000));
    // eslint-disable-next-line no-console
    console.log("[agnic← headers]", Object.fromEntries(res.headers.entries()));
  }
  return res;
};

function headersToObject(h: unknown): Record<string, string> {
  if (!h) return {};
  if (typeof Headers !== "undefined" && h instanceof Headers) {
    return Object.fromEntries(h.entries());
  }
  if (Array.isArray(h)) return Object.fromEntries(h as [string, string][]);
  return { ...(h as Record<string, string>) };
}

function redactAuth(h: Record<string, string>): Record<string, string> {
  const out = { ...h };
  for (const k of Object.keys(out)) {
    if (k.toLowerCase() === "authorization") {
      const v = out[k] ?? "";
      out[k] = v ? `${v.slice(0, 14)}…(${v.length} chars)` : "(empty)";
    }
  }
  return out;
}

/** Default model IDs — can be overridden per call. */
export const Models = {
  vision: "anthropic/claude-sonnet-4.5",
  reasoning: "anthropic/claude-sonnet-4.5",
  cheap: "openai/gpt-4o-mini",
  draft: "anthropic/claude-sonnet-4.5",
} as const;

/** Surfaces a 402 Insufficient-Balance from Agnic in a typed way. */
export class InsufficientBalanceError extends Error {
  constructor(public readonly side: "owner" | "signer") {
    super(`Insufficient Agnic balance (${side})`);
    this.name = "InsufficientBalanceError";
  }
}

/** Inspect an OpenAI SDK error and rethrow as InsufficientBalanceError on HTTP 402. */
export function rethrowIf402(err: unknown, side: "owner" | "signer"): never {
  // OpenAI SDK throws OpenAI.APIError with `.status`.
  if (typeof err === "object" && err !== null && "status" in err && (err as { status?: number }).status === 402) {
    throw new InsufficientBalanceError(side);
  }
  throw err as Error;
}
