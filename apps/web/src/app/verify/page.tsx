import Link from "next/link";
import { VerifyWidget } from "@/components/VerifyWidget";

export const metadata = {
  title: "Verify a signed document · UniSi",
  description:
    "Verify a UniSi audit-trail certificate and confirm a signed document matches it. No account required.",
};

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="border-b border-zinc-100 dark:border-zinc-900">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            UniSi
          </Link>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-14">
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-4">
              <ShieldIcon />
              Independent verification
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Verify a signed document
            </h1>
            <p className="mt-3 text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Upload the audit-trail certificate (and optionally the signed PDF). We confirm the
              platform signature is intact and that the document matches the trail. Files are
              processed in memory — nothing is stored, and no account is needed.
            </p>
          </div>

          <VerifyWidget />

          <p className="mt-6 text-center text-xs text-zinc-500">
            Don&apos;t have the files? The audit trail and signed document are available from the
            sender&apos;s submission page in UniSi.
          </p>
        </div>
      </main>

      <footer className="border-t border-zinc-100 dark:border-zinc-900 py-6">
        <div className="max-w-3xl mx-auto px-6 text-center text-xs text-zinc-500">
          UniSi · open source · AGPL-3.0
        </div>
      </footer>
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

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
