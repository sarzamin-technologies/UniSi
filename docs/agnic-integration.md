# Agnic Integration Guide

This guide walks through integrating Agnic as your app's **OAuth login provider**, **AI gateway**, and **prepaid wallet** — based on a working Next.js 14 implementation.

Users sign in with their Agnic account, receive a free $5 credit, and spend from their wallet balance for every AI API call your app proxies through Agnic.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [Prerequisites](#2-prerequisites)
3. [Environment Variables](#3-environment-variables)
4. [Dependencies](#4-dependencies)
5. [Session Setup (iron-session)](#5-session-setup-iron-session)
6. [OAuth Authentication](#6-oauth-authentication)
   - [Auth Utilities (PKCE, token exchange)](#61-auth-utilities)
   - [Login Route (full-page redirect)](#62-login-route-full-page-redirect)
   - [Login Route (popup)](#63-login-route-popup)
   - [Callback Route (full-page)](#64-callback-route-full-page)
   - [Popup Callback Route](#65-popup-callback-route)
   - [Session Route (check auth / logout)](#66-session-route)
7. [Balance Fetching & Display](#7-balance-fetching--display)
   - [Agnic API Helpers](#71-agnic-api-helpers)
   - [Balance API Route](#72-balance-api-route)
   - [BalanceDisplay Component](#73-balancedisplay-component)
8. [AI Gateway — Proxying API Calls](#8-ai-gateway--proxying-api-calls)
   - [Chat Completions (text models)](#81-chat-completions-text-models)
   - [Image Generation](#82-image-generation)
9. [Top-Up / Wallet Funding](#9-top-up--wallet-funding)
10. [LoginGate Component](#10-logingate-component)
11. [Security Notes](#11-security-notes)
12. [Partner Program](#12-partner-program)
13. [Agnic API Reference](#13-agnic-api-reference)

---

## 1. Overview & Architecture

```
User Browser
│
├── GET /api/auth/login-popup   → redirect to api.agnic.ai/oauth/authorize (PKCE + CSRF)
│        ↕ (authorization code callback)
├── GET /api/auth/popup-callback → exchange code for tokens → store in httpOnly cookie
│
├── GET /api/balance             → server calls api.agnic.ai/api/balance → returns USD balance
│
├── POST /api/generate           → server calls api.agnic.ai/v1/chat/completions
│                                   (charged from user's Agnic wallet)
│
└── Redirect to app.agnic.ai/topup  → user adds USDC or card → postMessage back
```

All AI calls are **server-side** (Next.js API routes). The Agnic access token never touches the browser.

---

## 2. Prerequisites

- Register your OAuth application at [app.agnic.ai/oauth-clients](https://app.agnic.ai/oauth-clients) to get your **Client ID** (`app_…`) and optionally a **Partner ID** (`partner_…`)
- Register every redirect URI your app will use — the top-up `return_url` must also be listed here:
  - `http://localhost:3000/api/auth/callback`
  - `https://yourdomain.com/api/auth/callback`
  - `http://localhost:3000/api/auth/popup-callback`
  - `https://yourdomain.com/api/auth/popup-callback`
  - `https://yourdomain.com/` (or wherever you return after top-up)
- Next.js 14+ (App Router). Adjust route handlers for other frameworks.

> **Note:** Agnic OAuth is a public client (no client secret). Authentication security comes from PKCE.

---

## 3. Environment Variables

```bash
# .env.local

# Agnic OAuth client ID (register at app.agnic.ai)
AGNIC_OAUTH_CLIENT_ID=app_xxxxxxxxxxxxxxxxxxxx

# Also expose client ID to browser for the top-up popup URL
NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID=app_xxxxxxxxxxxxxxxxxxxx

# Your app's public URL — used for OAuth redirect_uri construction
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Session cookie encryption key — generate with: openssl rand -hex 32
SESSION_SECRET=your_64_char_hex_string_here

# Partner ID — assigned when you join the Partner Program (app.agnic.ai/oauth-clients)
# Adds commission attribution to every AI call your app makes.
# Omit if you have not joined the Partner Program.
AGNIC_PARTNER_ID=partner_xxxxxxxxxxxxxxxxxxxx

# Optional overrides (defaults shown)
AGNIC_API_BASE=https://api.agnic.ai
NEXT_PUBLIC_AGNIC_AUTH_URL=https://app.agnic.ai
NEXT_PUBLIC_AGNIC_TOPUP_URL=https://app.agnic.ai/topup
```

---

## 4. Dependencies

```bash
npm install iron-session openai
```

- **`iron-session`** — Encrypts and stores tokens in an httpOnly cookie. No database needed.
- **`openai`** — Used to talk to Agnic's OpenAI-compatible gateway (`api.agnic.ai/v1`).

---

## 5. Session Setup (iron-session)

`src/lib/session.ts`

```typescript
import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number;   // Unix timestamp in ms
  code_verifier?: string;       // Transient — cleared after auth
  oauth_state?: string;         // Transient — cleared after auth
}

const SESSION_OPTIONS = {
  cookieName: "my_app_session",  // Change to your app name
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 90,  // 90 days (matches Agnic refresh token lifetime)
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), SESSION_OPTIONS);
}
```

---

## 6. OAuth Authentication

Agnic uses **OAuth 2.0 Authorization Code** with **PKCE** (no client secret required).

Required scopes: `payments:sign balance:read`

### 6.1 Auth Utilities

`src/lib/auth.ts`

```typescript
import crypto from "crypto";

const AGNIC_API_BASE = process.env.AGNIC_API_BASE || "https://api.agnic.ai";
const CLIENT_ID = process.env.AGNIC_OAUTH_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

// --- PKCE ---

export function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  return { verifier, challenge };
}

// --- OAuth URL ---

export function buildAuthUrl(
  challenge: string,
  state: string,
  redirectPath: "/api/auth/callback" | "/api/auth/popup-callback"
): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${APP_URL}${redirectPath}`,
    response_type: "code",
    scope: "payments:sign balance:read",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  return `${AGNIC_API_BASE}/oauth/authorize?${params}`;
}

// --- Token Exchange ---

export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  redirectPath: "/api/auth/callback" | "/api/auth/popup-callback"
) {
  const res = await fetch(`${AGNIC_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: `${APP_URL}${redirectPath}`,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

// --- Token Refresh ---

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(`${AGNIC_API_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

// --- Get Valid Token (with auto-refresh) ---

import { getSession } from "./session";

export async function getValidAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session.access_token) return null;

  const FIVE_MINUTES = 5 * 60 * 1000;
  const needsRefresh =
    !session.token_expires_at ||
    Date.now() > session.token_expires_at - FIVE_MINUTES;

  if (needsRefresh && session.refresh_token) {
    try {
      const tokens = await refreshAccessToken(session.refresh_token);
      session.access_token = tokens.access_token;
      session.refresh_token = tokens.refresh_token;
      session.token_expires_at = Date.now() + tokens.expires_in * 1000;
      await session.save();
    } catch {
      await session.destroy();
      return null;
    }
  }

  return session.access_token;
}
```

### 6.2 Login Route (full-page redirect)

`src/app/api/auth/login/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generatePKCE, buildAuthUrl } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString("hex");

  session.code_verifier = verifier;
  session.oauth_state = state;
  await session.save();

  return NextResponse.redirect(buildAuthUrl(challenge, state, "/api/auth/callback"));
}
```

### 6.3 Login Route (popup)

`src/app/api/auth/login-popup/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generatePKCE, buildAuthUrl } from "@/lib/auth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString("hex");

  session.code_verifier = verifier;
  session.oauth_state = state;
  await session.save();

  return NextResponse.redirect(buildAuthUrl(challenge, state, "/api/auth/popup-callback"));
}
```

### 6.4 Callback Route (full-page)

`src/app/api/auth/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exchangeCodeForTokens } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) return NextResponse.redirect(`${APP_URL}/?error=${error}`);

  const session = await getSession();

  if (!code || state !== session.oauth_state) {
    return NextResponse.redirect(`${APP_URL}/?error=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, session.code_verifier!, "/api/auth/callback");
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token;
    session.token_expires_at = Date.now() + tokens.expires_in * 1000;
    session.code_verifier = undefined;
    session.oauth_state = undefined;
    await session.save();
    return NextResponse.redirect(`${APP_URL}/`);
  } catch {
    return NextResponse.redirect(`${APP_URL}/?error=token_exchange_failed`);
  }
}
```

### 6.5 Popup Callback Route

The popup variant uses `window.opener.postMessage` to notify the parent window, then closes itself.

`src/app/api/auth/popup-callback/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { exchangeCodeForTokens } from "@/lib/auth";

export const dynamic = "force-dynamic";

const successHtml = `
<!DOCTYPE html><html><body><script>
  try { window.opener.postMessage({ type: "agnic-oauth-result", success: true }, "*"); }
  catch(e) {}
  window.close();
</script></body></html>`;

const errorHtml = (msg: string) => `
<!DOCTYPE html><html><body><script>
  try { window.opener.postMessage({ type: "agnic-oauth-result", success: false, error: "${msg}" }, "*"); }
  catch(e) {}
  window.close();
</script></body></html>`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

  const session = await getSession();

  if (!code || state !== session.oauth_state) {
    // If postMessage fails (e.g. popup was navigated cross-origin), fall back to redirect
    return new NextResponse(errorHtml("invalid_state"), { headers: { "Content-Type": "text/html" } });
  }

  try {
    const tokens = await exchangeCodeForTokens(code, session.code_verifier!, "/api/auth/popup-callback");
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token;
    session.token_expires_at = Date.now() + tokens.expires_in * 1000;
    session.code_verifier = undefined;
    session.oauth_state = undefined;
    await session.save();
    // Fallback: if popup can't postMessage back (COOP headers), redirect to app
    return new NextResponse(
      `<!DOCTYPE html><html><body><script>
        try { window.opener.postMessage({ type: "agnic-oauth-result", success: true }, "*"); window.close(); }
        catch(e) { window.location.href = "${APP_URL}/"; }
      </script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch {
    return new NextResponse(errorHtml("token_exchange_failed"), { headers: { "Content-Type": "text/html" } });
  }
}
```

### 6.6 Session Route

`src/app/api/session/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Check authentication status
export async function GET() {
  const session = await getSession();
  return NextResponse.json({ authenticated: !!session.access_token });
}

// Logout
export async function DELETE() {
  const session = await getSession();
  await session.destroy();
  return NextResponse.json({ ok: true });
}
```

---

## 7. Balance Fetching & Display

### 7.1 Agnic API Helpers

`src/lib/agnic.ts`

```typescript
import OpenAI from "openai";

const AGNIC_API_BASE = process.env.AGNIC_API_BASE || "https://api.agnic.ai";

// Fetches current balance from Agnic
export async function getBalance(accessToken: string): Promise<number> {
  const res = await fetch(`${AGNIC_API_BASE}/api/balance?network=base`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
  const data = await res.json();
  // Agnic returns usdcBalance + creditBalance separately
  return parseFloat(data.usdcBalance || "0") + parseFloat(data.creditBalance || "0");
}

// Creates an OpenAI SDK client pointed at the Agnic gateway.
// The X-Partner-Id header attributes usage to your Partner account for commission tracking.
export function createAgnicClient(accessToken: string): OpenAI {
  const defaultHeaders: Record<string, string> = {};
  if (process.env.AGNIC_PARTNER_ID) {
    defaultHeaders["X-Partner-Id"] = process.env.AGNIC_PARTNER_ID;
  }
  return new OpenAI({
    apiKey: accessToken,
    baseURL: `${AGNIC_API_BASE}/v1`,
    defaultHeaders,
  });
}
```

### 7.2 Balance API Route

`src/app/api/balance/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getBalance } from "@/lib/agnic";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const balance = await getBalance(token);
    return NextResponse.json({ balance });
  } catch {
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 });
  }
}
```

### 7.3 BalanceDisplay Component

`src/components/BalanceDisplay.tsx`

```tsx
"use client";

interface Props {
  balance: number | undefined;
  onTopUp?: () => void;
}

export function BalanceDisplay({ balance, onTopUp }: Props) {
  const formatted = balance !== undefined ? formatCurrency(balance) : "…";

  return (
    <button
      onClick={onTopUp}
      className="flex items-center gap-1.5 text-sm font-medium"
      title="Add funds"
    >
      {/* Wallet icon */}
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 7h18M3 7a2 2 0 00-2 2v8a2 2 0 002 2h18a2 2 0 002-2V9a2 2 0 00-2-2M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2M16 13h.01" />
      </svg>
      <span>{formatted}</span>
      {onTopUp && <span className="text-xs text-zinc-400">+</span>}
    </button>
  );
}

// Formats balance with smart precision (shows sub-cent deductions)
function formatCurrency(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(5)}`;
  if (amount < 10)   return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
```

**Usage in a header/navbar:**

```tsx
// Fetch balance on the server or in a client component
const [balance, setBalance] = useState<number | undefined>();

useEffect(() => {
  fetch("/api/balance")
    .then(r => r.json())
    .then(d => setBalance(d.balance))
    .catch(() => {});
}, []);

<BalanceDisplay balance={balance} onTopUp={handleTopUp} />
```

---

## 8. AI Gateway — Proxying API Calls

Agnic's gateway is OpenAI API-compatible. Use the OpenAI SDK (or raw `fetch`) with `baseURL: "https://api.agnic.ai/v1"` and the user's Agnic access token as the API key. Costs are deducted from the user's wallet automatically.

### 8.1 Chat Completions (text models)

```typescript
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { createAgnicClient } from "@/lib/agnic";
import { getBalance } from "@/lib/agnic";

export async function POST(req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt } = await req.json();
  const client = createAgnicClient(token);

  try {
    const completion = await client.chat.completions.create({
      model: "openai/gpt-4o-mini",   // Any OpenRouter model ID works
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });

    const text = completion.choices[0].message.content;

    // Optionally fetch updated balance to return to the client
    let balance: number | undefined;
    try { balance = await getBalance(token); } catch {}

    return NextResponse.json({ text, balance });
  } catch (err: any) {
    // Agnic returns HTTP 402 when the wallet has insufficient funds
    if (err?.status === 402) {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
```

### 8.2 Image Generation

Image models return their output in `choices[0].message.images[]` (not in `content`).

```typescript
// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/auth";
import { getBalance } from "@/lib/agnic";

const AGNIC_API_BASE = process.env.AGNIC_API_BASE || "https://api.agnic.ai";

export async function POST(req: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, model = "google/gemini-2.5-flash-image" } = await req.json();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (process.env.AGNIC_PARTNER_ID) {
    headers["X-Partner-Id"] = process.env.AGNIC_PARTNER_ID;
  }

  const res = await fetch(`${AGNIC_API_BASE}/v1/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      modalities: ["image", "text"],
      max_tokens: 1024,
    }),
  });

  if (res.status === 402) {
    return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ error: body?.error?.message || "Generation failed" }, { status: 500 });
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;
  // Image URL is in the images array, not the text content
  const imageUrl = choice?.images?.[0]?.image_url?.url;
  const text = choice?.content || "";

  let balance: number | undefined;
  try { balance = await getBalance(token); } catch {}

  return NextResponse.json({ image: imageUrl, text, balance });
}
```

**Supported image models (via Agnic/OpenRouter):**

| Model ID | Notes |
|---|---|
| `google/gemini-2.5-flash-image` | Best value, fast |
| `openai/dall-e-3` | High quality |
| `openai/gpt-image-1` | GPT-4o image |

Fetch the live model catalog with pricing:
```
GET https://gw.agnic.ai/api/v1/models?output_modalities=image
```
Agnic applies a **~20% discount** versus OpenRouter's public rates.

---

## 9. Top-Up / Wallet Funding

Redirect or open a popup to Agnic's hosted checkout page. No backend work required.

> **Requirement:** The `return_url` must exactly match a URI registered in your OAuth client's `redirect_uris` list on the Agnic dashboard.

### Checkout URL parameters

| Parameter | Required | Description |
|---|---|---|
| `client_id` | Yes | Your `app_…` OAuth client ID |
| `return_url` | Yes | Absolute URL-encoded return URL (must be in registered `redirect_uris`) |
| `amount` | No | Preset amount in cents — highlights the matching package chip in the UI |

```typescript
// Client-side handler
function handleTopUp(amountCents?: number) {
  const clientId = process.env.NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID;
  const base = process.env.NEXT_PUBLIC_AGNIC_TOPUP_URL || "https://app.agnic.ai/topup";
  const returnUrl = encodeURIComponent(window.location.origin + "/");  // must match a registered redirect_uri
  let url = `${base}?client_id=${clientId}&return_url=${returnUrl}`;
  if (amountCents) url += `&amount=${amountCents}`;

  // Official threshold per Agnic docs: < 640px uses full-page redirect
  const isNarrow = window.innerWidth < 640;

  if (isNarrow) {
    // Mobile: full-page redirect; Agnic appends ?topup=success|cancelled on return
    window.location.href = url;
    return;
  }

  // Desktop: popup (self-closes ~2s after success)
  const w = 480, h = 720;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;
  window.open(url, "agnic-topup", `width=${w},height=${h},left=${left},top=${top}`);
}

// Listen for completion from popup.
// IMPORTANT: always validate origin — only trust messages from app.agnic.ai
useEffect(() => {
  function onMessage(e: MessageEvent) {
    if (e.origin !== "https://app.agnic.ai") return;  // security: reject other origins

    if (e.data?.type === "agnic:topup_complete") {
      fetch("/api/balance").then(r => r.json()).then(d => setBalance(d.balance));
      // optionally show a success toast
    }
    if (e.data?.type === "agnic:topup_cancelled") {
      // user closed the popup without paying — no action needed
    }
  }
  window.addEventListener("message", onMessage);
  return () => window.removeEventListener("message", onMessage);
}, []);

// On return from mobile redirect, check ?topup query param
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const result = params.get("topup");
  if (result === "success") {
    fetch("/api/balance").then(r => r.json()).then(d => setBalance(d.balance));
    // params.get("session_id") available for logging/correlation
  }
  // result === "cancelled" means user abandoned — handle if needed
}, []);
```

### Checkout branding

Configure display name and accent color in the Agnic dashboard under **OAuth Clients → your client → Checkout settings**. Changes take effect on the next page load — no code changes needed.

---

## 10. LoginGate Component

Wrap your app's main content with a gate that shows a login prompt to unauthenticated users.

```tsx
"use client";
import { useState, useEffect, useRef } from "react";

interface Props {
  children: React.ReactNode;
}

export function LoginGate({ children }: Props) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/session")
      .then(r => r.json())
      .then(d => setAuthenticated(d.authenticated));
  }, []);

  function openLoginPopup() {
    const isNarrow = window.innerWidth < 640;
    if (isNarrow) {
      window.location.href = "/api/auth/login";
      return;
    }

    const w = 480, h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    const popup = window.open(
      "/api/auth/login-popup",
      "agnic-login",
      `width=${w},height=${h},left=${left},top=${top}`
    );

    // Listen for postMessage success from popup-callback
    function onMessage(e: MessageEvent) {
      if (e.data?.type === "agnic-oauth-result") {
        window.removeEventListener("message", onMessage);
        if (e.data.success) setAuthenticated(true);
      }
    }
    window.addEventListener("message", onMessage);

    // Fallback: poll if popup closed without postMessage (e.g. COOP blocked)
    pollRef.current = setInterval(async () => {
      if (popup?.closed) {
        clearInterval(pollRef.current!);
        window.removeEventListener("message", onMessage);
        const res = await fetch("/api/session").then(r => r.json());
        if (res.authenticated) setAuthenticated(true);
      }
    }, 500);
  }

  if (authenticated === null) return null; // loading

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-2xl font-bold">Sign in to continue</h1>
        <p className="text-zinc-400">Connect your Agnic wallet to get started.</p>
        <button
          onClick={openLoginPopup}
          className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400"
        >
          Connect with Agnic
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
```

---

## 11. Security Notes

| Concern | Approach |
|---|---|
| Token storage | httpOnly, Secure, SameSite=Lax cookie — never in `localStorage` |
| PKCE | SHA256 code challenge; verifier cleared from session after exchange |
| CSRF | Random `state` parameter validated on every callback |
| Token expiry | Auto-refresh 5 minutes before expiry; session destroyed on refresh failure |
| AI API calls | Always server-side; browser never sees the Agnic access token |
| postMessage origin | Validate `e.origin === "https://app.agnic.ai"` before acting on any checkout message |
| Reference images | Validate MIME type and size on the server before forwarding |

---

## 12. Partner Program

The [Agnic Partner Program](https://docs.agnic.ai/docs/partner-program) lets your app earn commission on every AI call your users make through the gateway.

**How it works:**
- Apply at [app.agnic.ai/oauth-clients](https://app.agnic.ai/oauth-clients) to receive a **Partner ID** (`partner_xxx`) and a discounted pricing tier
- Add one header to every AI API call — the tier and commission rate are determined server-side from your Partner ID
- Track earnings at [app.agnic.ai/earnings](https://app.agnic.ai/earnings)

**The only code change** is passing `X-Partner-Id` on AI requests (already shown in sections 7.1 and 8.2 above via `AGNIC_PARTNER_ID`). Existing OpenAI-compatible code continues working unchanged.

```typescript
// The header is the entire integration — everything else is server-side
headers["X-Partner-Id"] = "partner_xxx";
```

> The pricing tier is fixed at the Partner record level. Do not pass tier or rate parameters — they are ignored.

---

## 13. Agnic API Reference

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/oauth/authorize` | GET | — | Start OAuth flow |
| `/oauth/token` | POST | — | Exchange code / refresh token |
| `/api/balance?network=base` | GET | Bearer token | Get USDC + credit balance |
| `/v1/chat/completions` | POST | Bearer token + `X-Partner-Id` | OpenAI-compatible chat & image gen |
| `/v1/models` | GET | Bearer token | List available models |

Base URL: `https://api.agnic.ai`

Model catalog (with pricing): `https://gw.agnic.ai/api/v1/models`

Top-up page: `https://app.agnic.ai/topup?client_id=YOUR_CLIENT_ID&return_url=YOUR_URL[&amount=CENTS]`

Partner dashboard: `https://app.agnic.ai/oauth-clients` (register) · `https://app.agnic.ai/earnings` (commissions)

Official docs: [Partner Program](https://docs.agnic.ai/docs/partner-program) · [Checkout](https://docs.agnic.ai/docs/partner-program/checkout)

---

*Based on a working Next.js 14 App Router integration. Adapt route handlers and session logic to your framework of choice.*
