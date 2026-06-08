"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { SignaturePad } from "@unisi/ui";
import { PdfPages } from "@/components/PdfPages";
import { AiPanel } from "./AiPanel";
import { colorForRole } from "@/lib/role-color";

type FieldType = "text" | "signature" | "initials" | "date" | "checkbox";

interface Field {
  id: string;
  type: FieldType;
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required?: boolean;
  label?: string;
  submitterRole: string;
}

interface SignerData {
  submitter: {
    id: string;
    role: string;
    name: string | null;
    email: string | null;
    status: string;
    fieldValues: Record<string, unknown>;
    completedAt: string | null;
  };
  submission: { id: string; status: string };
  template: {
    name: string;
    documents: { attachmentId: string; filename: string; pageCount: number; url: string | null }[];
    fields: Field[];
    allFields: Field[];
  };
}

type FieldValue = string | boolean | { dataUrl: string };

export function SigningForm({ slug }: { slug: string }) {
  const [data, setData] = useState<SignerData | null>(null);
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Render the PDF at the width actually available (full screen width on
  // mobile, capped on desktop) so the page is never cut off or covered.
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const [pdfWidth, setPdfWidth] = useState(760);
  useEffect(() => {
    const el = pdfAreaRef.current;
    if (!el) return;
    const update = () =>
      setPdfWidth(Math.max(260, Math.min(760, Math.floor(el.clientWidth))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [data]);

  useEffect(() => {
    fetch(`/api/sign/${slug}`)
      .then((r) => r.json())
      .then((d: SignerData) => {
        setData(d);
        if (d.submitter.status === "completed") setDone(true);
      })
      .catch(() => setError("Could not load this document. The link may have expired."));
  }, [slug]);

  const myFields = data?.template.fields ?? [];
  const requiredMissing = useMemo(() => {
    return myFields
      .filter((f) => f.required ?? true)
      .filter((f) => {
        const v = values[f.id];
        if (f.type === "checkbox") return v !== true;
        if (f.type === "signature" || f.type === "initials") {
          return !v || (typeof v === "object" && !v.dataUrl);
        }
        return !v || (typeof v === "string" && v.trim() === "");
      });
  }, [myFields, values]);

  async function submit() {
    if (!data) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sign/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "submit_failed");
      setSubmitting(false);
    }
  }

  if (error && !data) {
    return (
      <main className="max-w-md mx-auto p-8 text-center">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }
  if (!data) return <main className="p-8 text-zinc-500">Loading…</main>;

  if (done) {
    return (
      <main className="max-w-md mx-auto p-8 text-center space-y-3">
        <h1 className="text-2xl font-bold">Thanks!</h1>
        <p className="text-zinc-500">Your signature has been recorded.</p>
        <p className="text-sm text-zinc-500">
          You can close this tab — a copy of the signed document will be emailed to you.
        </p>
      </main>
    );
  }

  const doc = data.template.documents[0];

  return (
    <div className="flex flex-col lg:h-screen lg:flex-row">
      {/* PDF preview */}
      <div
        ref={pdfAreaRef}
        className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900 p-3 sm:p-6 min-h-[45vh] lg:min-h-0"
      >
        {doc?.url ? (
          <div className="mx-auto inline-block max-w-full">
            <PdfPages
              url={doc.url}
              pageWidthPx={pdfWidth}
              overlay={(pageIndex, dims) => (
                <>
                  {data.template.allFields
                    .filter((f) => f.pageIndex === pageIndex)
                    .map((f) => {
                      const isMine = f.submitterRole === data.submitter.role;
                      const c = colorForRole(f.submitterRole);
                      return (
                        <div
                          key={f.id}
                          className="absolute rounded-sm"
                          style={{
                            left: f.x * dims.widthPx,
                            top: f.y * dims.heightPx,
                            width: f.w * dims.widthPx,
                            height: f.h * dims.heightPx,
                            border: `${isMine ? 2 : 1}px solid ${c.border}`,
                            backgroundColor: c.fill,
                            opacity: isMine ? 1 : 0.45,
                            pointerEvents: "none",
                          }}
                          title={`${f.type} · ${f.submitterRole}`}
                        />
                      );
                    })}
                </>
              )}
            />
          </div>
        ) : (
          <p className="text-zinc-500">Loading document…</p>
        )}
      </div>

      {/* Signing panel */}
      <aside className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 overflow-y-auto">
        <h1 className="text-xl font-bold">{data.template.name}</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Signing as {data.submitter.name ?? data.submitter.email ?? data.submitter.role}
        </p>

        <ol className="space-y-5">
          {myFields.map((f, i) => (
            <li key={f.id} className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-zinc-500 block">
                {i + 1}. {f.label ?? f.type}
                {(f.required ?? true) && <span className="text-red-500">*</span>}
              </label>
              <FieldEditor
                field={f}
                value={values[f.id]}
                onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))}
              />
            </li>
          ))}
        </ol>

        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || requiredMissing.length > 0}
          className="mt-6 w-full px-4 py-3 bg-emerald-500 text-white rounded-md font-semibold disabled:opacity-50"
        >
          {submitting
            ? "Submitting…"
            : requiredMissing.length > 0
              ? `${requiredMissing.length} field${requiredMissing.length === 1 ? "" : "s"} left`
              : "Finish signing"}
        </button>

      </aside>

      {/* AI Q&A panel — fills full viewport height for max chat space */}
      <aside className="w-96 shrink-0 border-l border-zinc-200 dark:border-zinc-800 hidden lg:block h-full">
        <AiPanel slug={slug} />
      </aside>
    </div>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: FieldValue | undefined;
  onChange: (v: FieldValue) => void;
}) {
  switch (field.type) {
    case "signature":
    case "initials":
      return (
        <div className="overflow-x-auto">
          <SignaturePad
            width={300}
            height={120}
            onChange={(dataUrl) => {
              if (dataUrl) onChange({ dataUrl });
            }}
          />
        </div>
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        />
      );
    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5"
        />
      );
    case "text":
    default:
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        />
      );
  }
}
