"use client";
import { useState } from "react";

/** Collapsible "How to use" panel for the settings sections. */
export function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        <span>{title}</span>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="space-y-3 px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {children}
      </div>
    </details>
  );
}

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            /* clipboard may be unavailable */
          }
        }}
        className="absolute right-2 top-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/20"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
