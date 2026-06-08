"use client";
import { useEffect, useState } from "react";

/**
 * Owner profile. Agnic identity is a wallet DID with no email/name, so the
 * sender shown on signing-invite emails comes from what the owner enters here.
 */
export function ProfileSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then(async (res) => {
        if (res.ok) {
          const d = (await res.json()) as { name: string | null; email: string | null };
          setName(d.name ?? "");
          setEmail(d.email ?? "");
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      if (res.ok) {
        const d = (await res.json()) as { name: string | null; email: string | null };
        setName(d.name ?? "");
        setEmail(d.email ?? "");
        setSaved(true);
      } else {
        setError("Please enter a valid name and email, then try again.");
      }
    } catch {
      setError("Something went wrong saving your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Your profile</h2>
        <p className="text-sm text-zinc-500">
          Shown as the sender on the signing-invite emails you send. Recipients see “
          {name.trim() || "Someone"} has requested your signature.”
        </p>
      </header>

      <form onSubmit={save} className="space-y-4 max-w-md">
        <div className="space-y-1">
          <label htmlFor="profile-name" className="block text-sm font-medium">
            Display name or organization
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Jane Doe, or Acme Inc."
            disabled={!loaded}
            className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="profile-email" className="block text-sm font-medium">
            Reply-to email <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <input
            id="profile-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setSaved(false);
            }}
            placeholder="you@example.com"
            disabled={!loaded}
            className="w-full px-3 py-2 text-sm rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 disabled:opacity-50"
          />
          <p className="text-xs text-zinc-500">
            If set, signers can reply directly to you. Agnic doesn’t share your email, so this is
            entered manually.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !loaded}
            className="px-3 py-2 text-sm bg-emerald-500 text-white rounded-md font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
          {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
          {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        </div>
      </form>
    </section>
  );
}
