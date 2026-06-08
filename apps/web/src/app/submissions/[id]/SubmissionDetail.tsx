"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface Submission {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  templateId: string | null;
}

interface Submitter {
  id: string;
  role: string;
  name: string | null;
  email: string | null;
  status: string;
  slug: string;
  openedAt: string | null;
  completedAt: string | null;
}

interface Detail {
  submission: Submission;
  submitters: Submitter[];
}

export function SubmissionDetail({ submissionId }: { submissionId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [completedDocs, setCompletedDocs] = useState<{ id: string; url: string; filename: string }[]>(
    [],
  );
  const [auditTrail, setAuditTrail] = useState<
    { id: string; url: string; filename: string; signed: boolean }[]
  >([]);

  useEffect(() => {
    fetch(`/api/submissions/${submissionId}`)
      .then((r) => r.json())
      .then((d: Detail) => setDetail(d));
  }, [submissionId]);

  useEffect(() => {
    if (detail?.submission.status !== "completed") return;
    fetch(`/api/submissions/${submissionId}/documents`)
      .then((r) => r.json())
      .then(
        (d: {
          documents: { id: string; url: string; filename: string }[];
          auditTrail?: { id: string; url: string; filename: string; signed: boolean }[];
        }) => {
          setCompletedDocs(d.documents);
          setAuditTrail(d.auditTrail ?? []);
        },
      );
  }, [submissionId, detail?.submission.status]);

  if (!detail) return <main className="p-8 text-zinc-500">Loading…</main>;
  const { submission, submitters } = detail;
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <main className="max-w-3xl mx-auto p-8 space-y-6">
      <Link
        href="/submissions"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Submissions
      </Link>
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold font-mono">{submission.id}</h1>
        <span className="text-sm text-zinc-500">{submission.status}</span>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-zinc-500">Signers</h2>
        <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
          {submitters.map((s) => (
            <li key={s.id} className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {s.name ?? "(unnamed)"} <span className="text-zinc-500">{s.email}</span>
                  </p>
                  <p className="text-xs text-zinc-500">{s.role}</p>
                </div>
                <span className="text-xs">{s.status}</span>
              </div>
              {s.status !== "completed" && (
                <CopyableLink url={`${appUrl}/sign/${s.slug}`} />
              )}
            </li>
          ))}
        </ul>
      </section>

      {submission.status === "completed" && (
        <section className="space-y-2">
          <h2 className="text-sm uppercase tracking-wide text-zinc-500">Signed documents</h2>
          {completedDocs.length === 0 ? (
            <p className="text-sm text-zinc-500">Stamping…</p>
          ) : (
            <ul className="space-y-2">
              {completedDocs.map((d) => (
                <li key={d.id}>
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:underline"
                  >
                    {d.filename}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {submission.status === "completed" && auditTrail.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm uppercase tracking-wide text-zinc-500">Audit trail</h2>
          <ul className="space-y-2">
            {auditTrail.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-600 hover:underline"
                >
                  {d.filename}
                </a>
                <span
                  className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${
                    d.signed
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {d.signed ? "Digitally signed" : "Unsigned"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            The certificate is signed by the UniSi platform and lists each signed document&apos;s
            SHA-256. Verify the signature in any PDF reader.
          </p>
        </section>
      )}
    </main>
  );
}

function CopyableLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for non-secure contexts.
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-2 flex items-stretch gap-1.5 max-w-full">
      <input
        ref={inputRef}
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 truncate"
      />
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="px-2 py-1 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        title="Open signing page in new tab"
      >
        Open
      </a>
      <button
        type="button"
        onClick={copy}
        className={`px-2 py-1 text-xs rounded-md font-medium ${
          copied
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
            : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90"
        }`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
