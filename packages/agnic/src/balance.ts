import { AGNIC_API_BASE } from "./config";
import type { OwnerToken, SignerToken } from "./tokens";

interface BalanceResponse {
  usdcBalance?: string;
  creditBalance?: string;
}

/** Fetch wallet balance in USD. Works for either owner or signer tokens. */
export async function fetchBalance(token: OwnerToken | SignerToken): Promise<number> {
  const res = await fetch(`${AGNIC_API_BASE}/api/balance?network=base`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Agnic balance fetch failed: ${res.status}`);
  const data = (await res.json()) as BalanceResponse;
  const usdc = parseFloat(data.usdcBalance ?? "0");
  const credit = parseFloat(data.creditBalance ?? "0");
  return usdc + credit;
}
