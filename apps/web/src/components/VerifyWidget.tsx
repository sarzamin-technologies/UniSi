"use client";
import { useState } from "react";

interface VerifyResult {
  document: { filename: string; sha256: string | null; matches: boolean | null } | null;
  trail: {
    signaturePresent: boolean;
    signatureValid: boolean;
    signerSubject?: string;
    matchesPlatformCert: boolean;
    submissionId?: string;
    chainHash?: string;
    documents: { sha256: string }[];
    signers: { name: string; email: string; signedAt?: string; ip?: string }[];
    error?: string;
  };
}

type Verdict = "ok" | "warn" | "fail";

function verdictOf(r: VerifyResult): { level: Verdict; title: string; detail: string } {
  if (!r.trail.signatureValid) {
    return {
      level: "fail",
      title: r.trail.signaturePresent ? "Signature invalid" : "Not signed",
      detail: r.trail.signaturePresent
        ? "The audit trail's signature did not verify — it may have been altered."
        : "This PDF has no platform signature.",
    };
  }
  if (r.document && r.document.matches === false) {
    return {
      level: "fail",
      title: "Document does not match",
      detail: "The uploaded document's hash is not the one this audit trail certifies.",
    };
  }
  if (!r.trail.matchesPlatformCert) {
    return {
      level: "warn",
      title: "Signed by an unknown certificate",
      detail: "The signature is valid but was not made by this platform's certificate.",
    };
  }
  return {
    level: "ok",
    title: r.document?.matches ? "Verified" : "Audit trail verified",
    detail: r.document?.matches
      ? "The signature is intact and the document matches this audit trail."
      : "The audit trail's signature is intact and from this platform.",
  };
}

const BANNER: Record<Verdict, string> = {
  ok: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-100",
  warn: "bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-100",
  fail: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/40 dark:border-red-900 dark:text-red-100",
};
const ICON_BG: Record<Verdict, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  fail: "bg-red-500",
};

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function VerifyWidget() {
  const [doc, setDoc] = useState<File | null>(null);
  const [trail, setTrail] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function verify() {
    if (!trail) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.set("auditTrail", trail);
      if (doc) fd.set("document", doc);
      const res = await fetch("/api/verify", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setResult(body as VerifyResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "verification_failed");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDoc(null);
    setTrail(null);
    setResult(null);
    setError(null);
  }

  const verdict = result ? verdictOf(result) : null;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DropZone label="Audit trail" hint="The platform-signed certificate" required file={trail} onChange={setTrail} />
          <DropZone label="Signed document" hint="Optional — to confirm it matches" file={doc} onChange={setDoc} />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={verify}
            disabled={!trail || busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400 disabled:opacity-50 shadow-sm shadow-emerald-500/20"
          >
            {busy && <Spinner />}
            {busy ? "Verifying…" : "Verify"}
          </button>
          {(result || error) && (
            <button
              type="button"
              onClick={reset}
              className="px-3 py-2.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Reset
            </button>
          )}
          {error && <span className="text-sm text-red-500">{error}</span>}
        </div>
      </div>

      {result && verdict && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          <div className={`flex items-start gap-3 border-b px-6 sm:px-8 py-4 ${BANNER[verdict.level]}`}>
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${ICON_BG[verdict.level]}`}
            >
              {verdict.level === "ok" ? <CheckIcon /> : verdict.level === "warn" ? <BangIcon /> : <CrossIcon />}
            </span>
            <div>
              <p className="font-semibold leading-tight">{verdict.title}</p>
              <p className="text-sm opacity-80 mt-0.5">{verdict.detail}</p>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden">
              <Cell label="Signature" ok={result.trail.signatureValid}>
                {result.trail.signatureValid ? "Valid (PAdES · PKCS#7)" : "Invalid or absent"}
              </Cell>
              <Cell label="Signed by this platform" ok={result.trail.matchesPlatformCert}>
                {result.trail.matchesPlatformCert ? "Yes" : "No"}
              </Cell>
              {result.document && (
                <Cell label="Document matches trail" ok={result.document.matches ?? false}>
                  {result.document.matches ? "Yes" : "No"}
                </Cell>
              )}
              <Cell label="Signer certificate">{result.trail.signerSubject ?? "—"}</Cell>
            </div>

            {(result.trail.submissionId || result.trail.chainHash) && (
              <dl className="space-y-2 text-sm">
                {result.trail.submissionId && (
                  <KV label="Submission ID">
                    <code className="text-xs">{result.trail.submissionId}</code>
                  </KV>
                )}
                {result.trail.chainHash && (
                  <KV label="Audit chain hash">
                    <code className="text-xs break-all text-zinc-500">{result.trail.chainHash}</code>
                  </KV>
                )}
              </dl>
            )}

            {result.trail.signers.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
                  Signers ({result.trail.signers.length})
                </p>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  {result.trail.signers.map((s, i) => (
                    <li key={i} className="px-3 py-2 text-sm">
                      <span className="font-medium">{s.name || "(unnamed)"}</span>{" "}
                      <span className="text-zinc-500">&lt;{s.email}&gt;</span>
                      {(s.signedAt || s.ip) && (
                        <span className="block text-xs text-zinc-500">
                          {s.signedAt && `signed ${s.signedAt}`}
                          {s.signedAt && s.ip && " · "}
                          {s.ip && `IP ${s.ip}`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-zinc-500 leading-relaxed">
              A pass means the audit trail&apos;s signature is intact and, if a document was
              provided, its SHA-256 is one the trail certifies. This attests document integrity and
              platform origin — not the real-world identity of the signers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DropZone({
  label,
  hint,
  file,
  onChange,
  required,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
  required?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type === "application/pdf") onChange(f);
      }}
      className={`relative rounded-xl border-2 border-dashed p-4 transition-colors ${
        drag
          ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
          : file
            ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/10"
            : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600"
      }`}
    >
      <label className="block cursor-pointer">
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          aria-label={label}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              file
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
            }`}
          >
            <DocIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {label}
              {required && <span className="text-zinc-400 font-normal"> · required</span>}
            </p>
            {file ? (
              <p className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-300 truncate">
                {file.name}{" "}
                <span className="text-xs text-zinc-400">({fmtSize(file.size)})</span>
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-zinc-500">{hint} · drag &amp; drop or click</p>
            )}
          </div>
        </div>
      </label>
      {file && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-2 right-2 z-10 text-zinc-400 hover:text-red-500 text-lg leading-none"
          aria-label={`Remove ${label}`}
          title="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Cell({ label, ok, children }: { label: string; ok?: boolean; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-950 px-3 py-2.5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div
        className={`text-sm font-medium mt-0.5 ${
          ok === undefined
            ? "text-zinc-800 dark:text-zinc-200"
            : ok
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function KV({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
      <dt className="text-xs text-zinc-500 sm:w-40 shrink-0">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Spinner() {
  return (
    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
  );
}
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path d="m5 12 5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}
function BangIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path d="M12 7v6M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}
