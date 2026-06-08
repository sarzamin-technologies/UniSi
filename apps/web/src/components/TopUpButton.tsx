"use client";
import { useEffect, useState } from "react";
import { BalanceDisplay } from "@unisi/ui";

const AGNIC_TOPUP_URL = process.env.NEXT_PUBLIC_AGNIC_TOPUP_URL ?? "https://app.agnic.ai/topup";
const AGNIC_ORIGIN = "https://app.agnic.ai";

/**
 * Owner-side balance + top-up. Polls /api/balance on mount, listens for the
 * Agnic top-up postMessage, and refreshes balance when funding succeeds.
 *
 * Mobile (<640px) → full-page redirect with `?topup=success|cancelled` return.
 * Desktop          → centered popup.
 */
export function TopUpButton() {
  const [balance, setBalance] = useState<number | undefined>();

  async function refresh() {
    try {
      const r = await fetch("/api/balance");
      if (r.ok) {
        const d = (await r.json()) as { balance: number };
        setBalance(d.balance);
      }
    } catch {
      // ignore — keep previous value
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  // Listen for top-up popup completion.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== AGNIC_ORIGIN) return;
      if (e.data?.type === "agnic:topup_complete") refresh();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Mobile redirect-back: ?topup=success in URL after redirect-flow funding.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      refresh();
      // Strip the query so a refresh doesn't re-trigger.
      const url = new URL(window.location.href);
      url.searchParams.delete("topup");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  function handleTopUp() {
    const clientId = process.env.NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID;
    if (!clientId) return;
    const returnUrl = encodeURIComponent(window.location.origin + "/");
    const url = `${AGNIC_TOPUP_URL}?client_id=${clientId}&return_url=${returnUrl}`;
    if (window.innerWidth < 640) {
      window.location.href = url;
      return;
    }
    const w = 480;
    const h = 720;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    window.open(url, "agnic-topup", `width=${w},height=${h},left=${left},top=${top}`);
  }

  return <BalanceDisplay balance={balance} onTopUp={handleTopUp} />;
}
