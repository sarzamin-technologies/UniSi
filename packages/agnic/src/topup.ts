import { AGNIC_TOPUP_URL } from "./config";

export interface TopUpOptions {
  clientId: string;
  /** Absolute return URL — must exactly match a redirect URI registered for the OAuth client. */
  returnUrl: string;
  /** Optional preset amount in cents — highlights the matching package chip. */
  amountCents?: number;
}

export function buildTopUpUrl(opts: TopUpOptions): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    return_url: opts.returnUrl,
  });
  if (opts.amountCents) params.set("amount", String(opts.amountCents));
  return `${AGNIC_TOPUP_URL}?${params.toString()}`;
}
