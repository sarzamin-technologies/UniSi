"use client";
import { useEffect, useRef, useState } from "react";

export interface LoginGateProps {
  children: React.ReactNode;
  /** Where to land after login. Defaults to current path. */
  loginPath?: string;
}

/**
 * Guards children behind an Agnic login. Uses a popup on desktop, falls back
 * to full-page redirect on narrow viewports per the Agnic guide §10.
 *
 * Polls /api/session if the popup closes without postMessage (e.g. blocked by
 * Cross-Origin-Opener-Policy headers).
 */
export function LoginGate({ children, loginPath = "/api/auth/login" }: LoginGateProps) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((d: { authenticated: boolean; terms_accepted: boolean }) => {
        if (d.authenticated && !d.terms_accepted) {
          window.location.href = "/accept-terms";
        } else {
          setAuthed(d.authenticated);
        }
      })
      .catch(() => setAuthed(false));
  }, []);

  function openLogin() {
    if (typeof window === "undefined") return;
    const isNarrow = window.innerWidth < 640;
    if (isNarrow) {
      window.location.href = loginPath;
      return;
    }

    const w = 480;
    const h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      "/api/auth/login-popup",
      "agnic-login",
      `width=${w},height=${h},left=${left},top=${top}`,
    );

    function onMessage(e: MessageEvent) {
      if (e.data?.type === "agnic-oauth-result") {
        window.removeEventListener("message", onMessage);
        if (e.data.success) {
          if (e.data.terms_pending) {
            window.location.href = "/accept-terms";
          } else {
            setAuthed(true);
          }
        }
      }
    }
    window.addEventListener("message", onMessage);

    pollRef.current = setInterval(async () => {
      if (popup?.closed) {
        if (pollRef.current) clearInterval(pollRef.current);
        window.removeEventListener("message", onMessage);
        try {
          const res = await fetch("/api/session").then((r) => r.json());
          if (res.authenticated && !res.terms_accepted) {
            window.location.href = "/accept-terms";
          } else if (res.authenticated) {
            setAuthed(true);
          }
        } catch {
          // ignore — user can retry
        }
      }
    }, 500);
  }

  if (authed === null) return null;

  if (!authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-bold">Sign in to UniSi</h1>
        <p className="text-zinc-500">Connect your Agnic wallet to continue.</p>
        <button
          type="button"
          onClick={openLogin}
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400"
        >
          Connect with Agnic
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
