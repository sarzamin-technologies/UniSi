"use client";
import { useEffect, useState } from "react";
import { Guide, CodeBlock } from "./Guide";

interface Token {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function TokensSection() {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; plaintext: string } | null>(null);

  async function refresh() {
    const res = await fetch("/api/tokens");
    if (res.ok) {
      const { tokens } = (await res.json()) as { tokens: Token[] };
      setTokens(tokens);
    } else {
      setTokens([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) return;
      const { token } = (await res.json()) as { token: { id: string; plaintext: string } };
      setRevealed({ id: token.id, plaintext: token.plaintext });
      setName("");
      refresh();
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this token? Anything using it will break immediately.")) return;
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    refresh();
    if (revealed?.id === id) setRevealed(null);
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">API tokens</h2>
        <p className="text-sm text-zinc-500">
          Use as <code>Authorization: Bearer unisi_…</code> on any /api endpoint.
        </p>
      </header>

      <Guide title="How to use an API token">
        <p>
          API tokens let your own backend, scripts, or CI call UniSi without the interactive
          Agnic login. Send the token as a <code>Bearer</code> header on any <code>/api</code>{" "}
          endpoint — the same routes the dashboard uses (templates, submissions, etc.).
        </p>
        <p className="font-medium text-zinc-700 dark:text-zinc-300">List your templates</p>
        <CodeBlock
          code={`curl https://YOUR_HOST/api/templates \\
  -H "Authorization: Bearer unisi_xxx"`}
        />
        <p className="font-medium text-zinc-700 dark:text-zinc-300">
          Send a template for signing
        </p>
        <CodeBlock
          code={`curl -X POST https://YOUR_HOST/api/submissions \\
  -H "Authorization: Bearer unisi_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": "TEMPLATE_UUID",
    "submitters": [
      { "role": "Signer", "email": "jane@acme.com", "name": "Jane" }
    ]
  }'`}
        />
        <p>
          Treat a token like a password: keep it server-side only, never ship it in browser or
          mobile code. To rotate, create a new token and <strong>Revoke</strong> the old one —
          anything using it stops working immediately.
        </p>
      </Guide>

      <form onSubmit={create} className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Token name (e.g. CI deploy)"
          className="flex-1 px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!name.trim() || creating}
          className="px-3 py-2 text-sm bg-emerald-500 text-white rounded-md font-medium disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </form>

      {revealed && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-4 space-y-2">
          <p className="text-sm font-medium">
            Save this token now — it will not be shown again.
          </p>
          <code className="block break-all text-xs bg-white dark:bg-zinc-900 px-3 py-2 rounded">
            {revealed.plaintext}
          </code>
        </div>
      )}

      {tokens === null ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : tokens.length === 0 ? (
        <p className="text-zinc-500 text-sm">No tokens yet.</p>
      ) : (
        <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
          {tokens.map((t) => (
            <li key={t.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{t.name}</p>
                <p className="text-xs text-zinc-500">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt
                    ? ` · last used ${new Date(t.lastUsedAt).toLocaleString()}`
                    : " · never used"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => revoke(t.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
