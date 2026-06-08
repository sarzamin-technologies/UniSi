"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Mode = "upload" | "gdoc" | "generate";

const MODE_LABELS: Record<Mode, string> = {
  upload: "Upload PDF",
  gdoc: "Google Doc",
  generate: "✨ Generate with AI",
};

export default function NewTemplatePage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("upload");

  return (
    <main className="max-w-xl mx-auto p-8 space-y-6">
      <nav className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Dashboard
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <Link href="/templates" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Templates
        </Link>
      </nav>
      <h1 className="text-2xl font-bold">New template</h1>

      <div className="flex gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 p-1">
        {(["upload", "gdoc", "generate"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 px-3 py-1.5 text-sm rounded-md font-medium whitespace-nowrap transition-colors ${
              mode === m
                ? "bg-white dark:bg-zinc-800 shadow-sm"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {mode === "upload" && (
        <UploadForm onCreated={(id) => router.push(`/templates/${id}`)} />
      )}
      {mode === "gdoc" && (
        <GoogleDocForm onCreated={(id) => router.push(`/templates/${id}`)} />
      )}
      {mode === "generate" && (
        <GenerateForm onCreated={(id) => router.push(`/templates/${id}?await_draft=1`)} />
      )}
    </main>
  );
}

function UploadForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    if (name) fd.set("name", name);
    try {
      const res = await fetch("/api/templates", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const { template } = (await res.json()) as { template: { id: string } };
      onCreated(template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "upload_failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="file"
        accept="application/pdf"
        required
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
      />
      <input
        type="text"
        placeholder="Template name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={!file || busy}
        className="px-4 py-2 bg-emerald-500 text-white rounded-md font-medium disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}

function GoogleDocForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/templates/import-gdoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), name: name.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const { template } = (await res.json()) as { template: { id: string } };
      onCreated(template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "import_failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="url"
        required
        placeholder="https://docs.google.com/document/d/…/edit"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
      />
      <input
        type="text"
        placeholder="Template name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-zinc-500 leading-relaxed">
        The doc must be shared publicly — in Google Docs, open{" "}
        <span className="font-medium">Share → General access → “Anyone with the link”</span>{" "}
        (Viewer). We import it as a PDF; your edits in Google Docs won’t sync afterward.
      </p>
      <button
        type="submit"
        disabled={url.trim().length === 0 || busy}
        className="px-4 py-2 bg-emerald-500 text-white rounded-md font-medium disabled:opacity-50"
      >
        {busy ? "Importing…" : "Import from Google Docs"}
      </button>
    </form>
  );
}

function GenerateForm({ onCreated }: { onCreated: (id: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, name: name || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const { template } = (await res.json()) as { template: { id: string } };
      onCreated(template.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "generate_failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        rows={6}
        required
        placeholder={`Describe the document you need, e.g.:

"A mutual NDA between Acme Inc and a freelance designer in California, 2-year confidentiality period, no non-compete, governed by Delaware law."`}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-sans"
      />
      <input
        type="text"
        placeholder="Template name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-zinc-500">
        AI generation runs on your Agnic wallet — typically a few cents per document.
      </p>
      <button
        type="submit"
        disabled={prompt.trim().length === 0 || busy}
        className="px-4 py-2 bg-emerald-500 text-white rounded-md font-medium disabled:opacity-50"
      >
        {busy ? "Drafting…" : "Generate draft"}
      </button>
    </form>
  );
}
