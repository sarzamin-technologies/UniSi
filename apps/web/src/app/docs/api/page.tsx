import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { ApiDocView } from "./ApiDocView";

export const metadata = {
  title: "API Reference · UniSi",
  description: "Complete reference for every UniSi HTTP endpoint.",
};

/** Read the canonical reference (docs/API.md at the repo root). The app runs
 * with cwd = apps/web, so the doc is two levels up; a couple of fallbacks keep
 * it working across dev/build layouts. */
function loadApiDoc(): string | null {
  const candidates = [
    path.join(process.cwd(), "../../docs/API.md"),
    path.join(process.cwd(), "docs/API.md"),
    path.join(process.cwd(), "../../../docs/API.md"),
  ];
  for (const p of candidates) {
    try {
      return fs.readFileSync(p, "utf8");
    } catch {
      /* try next */
    }
  }
  return null;
}

export default function ApiDocsPage() {
  const content = loadApiDoc();
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-900 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            UniSi
          </Link>
          <Link
            href="/settings"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Settings
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-10">
          {content ? (
            <ApiDocView content={content} />
          ) : (
            <div className="text-sm text-zinc-500">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">API Reference</h1>
              <p className="mt-3">
                The reference couldn&apos;t be loaded here. See{" "}
                <code>docs/API.md</code> in the repository.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 text-emerald-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M16 4v4h4" />
      <path d="M7 17c2-2 4-2 5 0s3 2 5 0" />
    </svg>
  );
}
