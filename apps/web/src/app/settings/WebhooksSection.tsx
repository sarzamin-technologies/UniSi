"use client";
import { useEffect, useState } from "react";
import { Guide, CodeBlock } from "./Guide";

interface Endpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

const EVENTS = [
  "submission.created",
  "submitter.opened",
  "submitter.signed",
  "submission.completed",
] as const;

export function WebhooksSection() {
  const [rows, setRows] = useState<Endpoint[] | null>(null);
  const [url, setUrl] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(EVENTS));
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);

  async function refresh() {
    const res = await fetch("/api/webhooks");
    if (res.ok) {
      const { endpoints } = (await res.json()) as { endpoints: Endpoint[] };
      setRows(endpoints);
    } else {
      setRows([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!url || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, events: Array.from(selected) }),
      });
      if (!res.ok) return;
      const { endpoint, secret } = (await res.json()) as {
        endpoint: { id: string };
        secret: string;
      };
      setRevealed({ id: endpoint.id, secret });
      setUrl("");
      refresh();
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this webhook? Pending deliveries will stop.")) return;
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    refresh();
  }

  function toggleEvent(ev: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ev)) next.delete(ev);
      else next.add(ev);
      return next;
    });
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Webhooks</h2>
        <p className="text-sm text-zinc-500">
          Signed POSTs with header <code>X-UniSi-Signature: t=…,v1=hmac_sha256</code>.
        </p>
      </header>

      <Guide title="How to receive & verify webhooks">
        <p>
          When a subscribed event happens, UniSi sends a <code>POST</code> with a JSON body to your
          endpoint. Each request carries these headers:
        </p>
        <ul className="list-disc pl-5 space-y-0.5">
          <li>
            <code>X-UniSi-Event</code> — the event name (e.g. <code>submission.completed</code>)
          </li>
          <li>
            <code>X-UniSi-Delivery</code> — a unique delivery id (use it to dedupe retries)
          </li>
          <li>
            <code>X-UniSi-Signature</code> — <code>t=&lt;unix_ts&gt;,v1=&lt;hmac&gt;</code>
          </li>
        </ul>
        <p>
          Verify with the <strong>signing secret</strong> shown once when you add the endpoint. The
          HMAC is computed over <code>t.rawBody</code> — use the{" "}
          <strong>raw request body</strong>, not the re-serialized object.
        </p>
        <CodeBlock
          code={`import crypto from "node:crypto";

// rawBody = exact bytes received; secret = the signing secret
function verifyUnisi(rawBody, header, secret) {
  const p = Object.fromEntries(header.split(",").map((kv) => kv.split("=")));
  const expected = crypto
    .createHmac("sha256", secret)
    .update(\`\${p.t}.\${rawBody}\`)
    .digest("hex");
  const valid =
    p.v1.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(p.v1), Buffer.from(expected));
  const fresh = Math.abs(Date.now() / 1000 - Number(p.t)) < 300; // 5-min window
  return valid && fresh;
}`}
        />
        <p>
          Respond with any <code>2xx</code> to acknowledge. Non-2xx responses and timeouts are
          retried with backoff. Example body for <code>submission.completed</code>:
        </p>
        <CodeBlock
          code={`{
  "event": "submission.completed",
  "timestamp": "2026-01-01T12:00:00.000Z",
  "data": {
    "submission": {
      "id": "…", "status": "completed",
      "template_id": "…", "created_at": "…", "completed_at": "…"
    },
    "submitters": [
      { "id": "…", "role": "Signer", "email": "jane@acme.com",
        "name": "Jane", "status": "completed", "completed_at": "…" }
    ]
  }
}`}
        />
      </Guide>

      <form onSubmit={create} className="space-y-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-4">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your.app/webhooks/unisi"
          className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
        />
        <div className="flex flex-wrap gap-2">
          {EVENTS.map((ev) => (
            <label
              key={ev}
              className={`px-2 py-1 text-xs rounded-md cursor-pointer border ${
                selected.has(ev)
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-200"
                  : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(ev)}
                onChange={() => toggleEvent(ev)}
                className="hidden"
              />
              {ev}
            </label>
          ))}
        </div>
        <button
          type="submit"
          disabled={!url || selected.size === 0 || creating}
          className="px-3 py-2 text-sm bg-emerald-500 text-white rounded-md font-medium disabled:opacity-50"
        >
          {creating ? "Creating…" : "Add endpoint"}
        </button>
      </form>

      {revealed && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-4 space-y-2">
          <p className="text-sm font-medium">
            Signing secret — store it now, it won't be shown again.
          </p>
          <code className="block break-all text-xs bg-white dark:bg-zinc-900 px-3 py-2 rounded">
            {revealed.secret}
          </code>
        </div>
      )}

      {rows === null ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-zinc-500 text-sm">No webhooks yet.</p>
      ) : (
        <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((e) => (
            <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm truncate">{e.url}</p>
                <p className="text-xs text-zinc-500 truncate">{e.events.join(", ")}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(e.id)}
                className="text-xs text-red-500 hover:underline"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
