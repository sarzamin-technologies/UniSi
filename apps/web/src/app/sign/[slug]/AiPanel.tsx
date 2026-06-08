"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { formatCurrency } from "@unisi/ui";
import {
  FRONTIER_MODELS,
  DEFAULT_FRONTIER_MODEL,
  isAllowedFrontierModel,
} from "@unisi/shared";

interface SessionState {
  authenticated: boolean;
  balance?: number | null;
}

interface Citation {
  filename: string;
  page: number;
  snippet: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  error?: string;
}

const AGNIC_TOPUP_URL =
  process.env.NEXT_PUBLIC_AGNIC_TOPUP_URL ?? "https://app.agnic.ai/topup";
const AGNIC_ORIGIN = "https://app.agnic.ai";

/**
 * Side panel for signer Q&A. Logged-out signers see an Agnic login CTA.
 * Logged-in signers see their wallet balance + a chat against the document.
 *
 * The signer's wallet pays — we never touch the account-owner's credit here.
 */
const MODEL_STORAGE_KEY = "unisi.signer.aiModel";

export function AiPanel({ slug }: { slug: string }) {
  const [state, setState] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_FRONTIER_MODEL);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Restore model preference once on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored && isAllowedFrontierModel(stored)) setModel(stored);
  }, []);

  function chooseModel(id: string) {
    setModel(id);
    window.localStorage.setItem(MODEL_STORAGE_KEY, id);
    setShowModelPicker(false);
  }

  async function refreshSession() {
    const res = await fetch(`/api/sign/${slug}/agnic/session`);
    if (res.ok) setState(await res.json());
    else setState({ authenticated: false });
  }

  useEffect(() => {
    refreshSession();
    // After OAuth redirect lands with ?agnic=ok, also re-poll.
    const params = new URLSearchParams(window.location.search);
    if (params.get("agnic") === "ok") {
      const url = new URL(window.location.href);
      url.searchParams.delete("agnic");
      window.history.replaceState({}, "", url.toString());
    }
  }, [slug]);

  // Listen for the top-up popup completion message.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== AGNIC_ORIGIN) return;
      if (e.data?.type === "agnic:topup_complete") refreshSession();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function startLogin() {
    // Full-page redirect — the signing form lives on a public path that may
    // be hard to popup-close cleanly across browsers. Cookie persists.
    window.location.href = `/api/sign/${slug}/agnic/login`;
  }

  async function signOut() {
    await fetch(`/api/sign/${slug}/agnic/session`, { method: "DELETE" });
    setMessages([]);
    setState({ authenticated: false });
  }

  function openTopUp() {
    const clientId = process.env.NEXT_PUBLIC_AGNIC_OAUTH_CLIENT_ID;
    if (!clientId) return;
    const returnUrl = encodeURIComponent(window.location.origin + window.location.pathname);
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

  async function send() {
    if (!input.trim() || busy) return;
    const question = input.trim();
    setInput("");
    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    try {
      const res = await fetch(`/api/sign/${slug}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, model }),
      });
      if (res.status === 402) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Your Agnic wallet ran out of funds — top up to keep asking.",
            error: "insufficient_balance",
          },
        ]);
        return;
      }
      if (res.status === 401) {
        await refreshSession();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Please sign in with Agnic to continue." },
        ]);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { answer: string; citations: Citation[] };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations },
      ]);
      // Refresh balance after each call (sub-cent deductions visible).
      refreshSession();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Couldn't reach the AI. Try again in a moment.",
          error: err instanceof Error ? err.message : "ask_failed",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // Auto-scroll to the newest message.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  if (state === null) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-zinc-500">
        Loading AI panel…
      </div>
    );
  }

  if (!state.authenticated) {
    return (
      <div className="h-full p-6 flex flex-col justify-center gap-3">
        <h3 className="font-semibold text-base">Have questions about this document?</h3>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Our AI assistant can explain clauses, flag unusual terms, and translate legalese.
          Sign in with Agnic — you'll pay from your own wallet (first $5 free for new accounts)
          so the sender never gets billed for your questions.
        </p>
        <button
          type="button"
          onClick={startLogin}
          className="w-full px-3 py-2 bg-emerald-500 text-white rounded-md text-sm font-medium hover:bg-emerald-400"
        >
          Sign in with Agnic
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0 relative">
        <h3 className="font-semibold text-sm">Ask about this document</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openTopUp}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            title="Top up Agnic wallet"
          >
            {state.balance != null ? formatCurrency(state.balance) : "—"} +
          </button>
          <button
            type="button"
            onClick={() => setShowModelPicker((v) => !v)}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 -m-1 rounded"
            title="Change AI model"
            aria-label="Change AI model"
            aria-expanded={showModelPicker}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .67.39 1.27 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.24.61.84 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={signOut}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1 -m-1 rounded"
            title="Sign out of Agnic"
            aria-label="Sign out of Agnic"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </div>
        {showModelPicker && (
          <ModelPicker
            current={model}
            onSelect={chooseModel}
            onClose={() => setShowModelPicker(false)}
          />
        )}
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-500">
            Try: <em>"Are there any auto-renewal terms?"</em> or{" "}
            <em>"What happens if I miss a payment?"</em>
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="rounded-lg bg-emerald-500 text-white px-3 py-2 max-w-[85%] whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:my-2 prose-pre:p-2 prose-pre:rounded-md prose-headings:mt-3 prose-headings:mb-1 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-code:before:content-none prose-code:after:content-none prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              </div>
              {m.citations && m.citations.length > 0 && (
                <ul className="text-xs text-zinc-500 space-y-1">
                  {m.citations.map((c, j) => (
                    <li key={j} className="border-l-2 border-emerald-300 pl-2">
                      <span className="font-medium">
                        {c.filename} · p.{c.page}
                      </span>
                      <span className="block italic">"{c.snippet}"</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="flex gap-1 items-center text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse [animation-delay:240ms]" />
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="px-4 pt-3 pb-2 flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            className="flex-1 px-2 py-1.5 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-md disabled:opacity-50"
          >
            {busy ? "…" : "Ask"}
          </button>
        </form>
        <AiDisclaimer />
      </div>
    </div>
  );
}

function AiDisclaimer() {
  return (
    <p className="px-4 pb-3 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
      <span className="font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
        Disclaimer:
      </span>{" "}
      Answers are AI-generated and may be inaccurate or incomplete. They are not legal
      advice and are not legally dependable — consult a qualified lawyer before
      committing to anything. UniSi is not responsible for any decisions made based on
      these responses.
    </p>
  );
}

function ModelPicker({
  current,
  onSelect,
  onClose,
}: {
  current: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute right-3 top-12 z-20 w-72 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
    >
      <div className="px-3 py-2 text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
        AI model
      </div>
      <ul className="max-h-80 overflow-y-auto py-1">
        {FRONTIER_MODELS.map((m) => {
          const active = m.id === current;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                  active ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
                }`}
                role="menuitemradio"
                aria-checked={active}
              >
                <span className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600 flex items-center justify-center">
                  {active && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                      {m.tier}
                    </span>
                  </span>
                  <span className="block text-xs text-zinc-500 leading-snug">{m.blurb}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-3 py-2 text-[10px] text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
        Per-call cost is billed from your Agnic wallet. Frontier models cost more.
      </p>
    </div>
  );
}
