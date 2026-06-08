"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SubmissionRow {
  id: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "text-zinc-500",
  in_progress: "text-amber-500",
  completed: "text-emerald-500",
  declined: "text-red-500",
  expired: "text-zinc-400",
};

export function SubmissionsList() {
  const [rows, setRows] = useState<SubmissionRow[] | null>(null);

  useEffect(() => {
    fetch("/api/submissions")
      .then((r) => r.json())
      .then((d: { submissions: SubmissionRow[] }) => setRows(d.submissions))
      .catch(() => setRows([]));
  }, []);

  if (rows === null) return <p className="text-zinc-500">Loading…</p>;
  if (rows.length === 0) {
    return (
      <p className="text-zinc-500">No submissions yet — send a template for signing first.</p>
    );
  }
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800">
      {rows.map((s) => (
        <li key={s.id} className="px-4 py-3 flex items-center justify-between">
          <div>
            <Link
              href={`/submissions/${s.id}`}
              className="font-mono text-sm hover:underline"
            >
              {s.id.slice(0, 8)}
            </Link>
            <p className="text-xs text-zinc-500">
              Created {new Date(s.createdAt).toLocaleString()}
            </p>
          </div>
          <span className={`text-xs font-medium ${STATUS_COLOR[s.status] ?? ""}`}>
            {s.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
