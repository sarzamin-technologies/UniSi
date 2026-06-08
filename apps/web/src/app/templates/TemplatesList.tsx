"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface TemplateRow {
  id: string;
  name: string;
  createdAt: string;
  fields: unknown[];
  documents: { filename?: string; pageCount?: number }[];
}

export function TemplatesList() {
  const [rows, setRows] = useState<TemplateRow[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d: { templates: TemplateRow[] }) => setRows(d.templates))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  function startEdit(t: TemplateRow) {
    setEditingId(t.id);
    setEditingName(t.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  async function commitEdit(id: string) {
    const name = editingName.trim();
    if (!name) return cancelEdit();
    setSavingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setRows((prev) => prev?.map((t) => (t.id === id ? { ...t, name } : t)) ?? prev);
      }
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  }

  async function deleteTemplate(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) setRows((prev) => prev?.filter((t) => t.id !== id) ?? prev);
    } finally {
      setDeletingId(null);
    }
  }

  if (rows === null) return <p className="text-zinc-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
        <p className="text-zinc-500 mb-4">No templates yet.</p>
        <Link href="/templates/new" className="text-emerald-600 hover:underline">
          Upload your first PDF →
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
      {rows.map((t) => {
        const isEditing = editingId === t.id;
        const isDeleting = deletingId === t.id;
        const isSaving = savingId === t.id;

        return (
          <li key={t.id} className="px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitEdit(t.id);
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    ref={inputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Escape" && cancelEdit()}
                    onBlur={() => commitEdit(t.id)}
                    disabled={isSaving}
                    className="flex-1 min-w-0 px-2 py-1 text-sm font-medium rounded border border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-zinc-900"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="shrink-0 text-emerald-600 hover:text-emerald-500 disabled:opacity-40 text-xs px-1"
                    title="Save"
                  >
                    {isSaving ? "…" : "✓"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-xs px-1"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <Link href={`/templates/${t.id}`} className="font-medium hover:underline truncate block">
                  {t.name}
                </Link>
              )}
              <p className="text-xs text-zinc-500 mt-0.5">
                {t.documents[0]?.filename} · {t.documents[0]?.pageCount ?? "?"} pages ·{" "}
                {Array.isArray(t.fields) ? t.fields.length : 0} fields
              </p>
            </div>

            <span className="text-xs text-zinc-400 shrink-0">
              {new Date(t.createdAt).toLocaleDateString()}
            </span>

            {!isEditing && (
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => startEdit(t)}
                  title="Rename"
                  className="p-1.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <PencilIcon />
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(t.id, t.name)}
                  disabled={isDeleting}
                  title="Delete"
                  className="p-1.5 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-40 transition-colors"
                >
                  {isDeleting ? <SpinnerIcon /> : <TrashIcon />}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 4h12M5 4V2.5h6V4M6 7v5M10 7v5M3 4l1 9.5h8L13 4" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <path d="M8 2a6 6 0 1 0 6 6" />
    </svg>
  );
}
