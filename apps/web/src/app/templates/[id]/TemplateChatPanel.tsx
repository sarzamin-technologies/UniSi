"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  suggestedMarkdown?: string;
}

interface Props {
  templateId: string;
  /** Present only for AI-generated templates — enables edit suggestions. */
  bodyMarkdown?: string;
  onClose: () => void;
  /** Called with the suggested new markdown when the user clicks "Apply".
   *  Omit for PDF / Google Doc templates where edits aren't possible. */
  onApplyEdit?: (markdown: string) => Promise<void>;
  /** True while the parent is regenerating the PDF after an applied edit. */
  applying?: boolean;
}

export function TemplateChatPanel({
  templateId,
  bodyMarkdown,
  onClose,
  onApplyEdit,
  applying = false,
}: Props) {
  const isAiTemplate = bodyMarkdown !== undefined;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading || applying) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/templates/${templateId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      if (res.status === 402) {
        setError("Insufficient Agnic wallet balance. Top up to continue.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const { answer, suggestedMarkdown } = (await res.json()) as {
        answer: string;
        suggestedMarkdown?: string;
      };

      setMessages((prev) => [...prev, { role: "assistant", content: answer, suggestedMarkdown }]);
    } catch {
      setError("Network error. Please try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }

  async function applyEdit(idx: number, markdown: string) {
    if (!onApplyEdit) return;
    setApplyingId(idx);
    try {
      await onApplyEdit(markdown);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === idx ? { ...m, suggestedMarkdown: undefined } : m,
        ),
      );
    } finally {
      setApplyingId(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <aside className="w-96 shrink-0 flex flex-col border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <SparkleIcon />
          <span className="text-sm font-semibold">AI Assistant</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          aria-label="Close AI panel"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <SparkleIcon className="mx-auto text-emerald-500" />
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {isAiTemplate ? "Ask about this document" : "AI field assistant"}
            </p>
            <p className="text-xs text-zinc-500">
              {isAiTemplate
                ? "Ask questions about the content, or request edits — e.g. \"Change the payment term to 45 days.\""
                : "Ask what fields are typically needed, get role suggestions, or check if anything is missing — e.g. \"What fields does an NDA usually need?\""}
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col gap-1 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed break-words ${
                msg.role === "user"
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {msg.role === "user" ? (
                <span className="whitespace-pre-wrap">
                  {msg.suggestedMarkdown
                    ? msg.content.replace(/```(?:markdown)?\n[\s\S]+?```/, "").trim()
                    : msg.content}
                </span>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-table:my-2 prose-pre:my-1 prose-blockquote:my-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.suggestedMarkdown
                      ? msg.content.replace(/```(?:markdown)?\n[\s\S]+?```/, "").trim()
                      : msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {msg.suggestedMarkdown && onApplyEdit && (
              <div className="w-full max-w-[85%] rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
                <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  Suggested edit ready
                </p>
                <pre className="text-[10px] text-emerald-700 dark:text-emerald-400 leading-relaxed overflow-hidden max-h-24 relative">
                  {msg.suggestedMarkdown.slice(0, 300)}
                  {msg.suggestedMarkdown.length > 300 && (
                    <span className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-emerald-50 dark:from-emerald-950/30" />
                  )}
                </pre>
                <button
                  type="button"
                  disabled={applyingId !== null || applying}
                  onClick={() => applyEdit(idx, msg.suggestedMarkdown!)}
                  className="w-full text-xs font-medium py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {applyingId === idx || applying ? "Applying…" : "Apply changes"}
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-xl px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or request an edit…"
          rows={2}
          disabled={loading || applying}
          className="w-full resize-none rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-400">Enter to send · Shift+Enter for newline</span>
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || loading || applying}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}

function SparkleIcon({ className = "text-emerald-500" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-0.5 items-center h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
