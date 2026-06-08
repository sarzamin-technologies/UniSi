import Link from "next/link";
import { LoginGate } from "@unisi/ui";
import { AppHeader } from "@/components/AppHeader";

interface Folder {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  accent: string;
}

const FOLDERS: Folder[] = [
  {
    href: "/templates",
    title: "Templates",
    desc: "Upload PDFs, generate with AI, place fields per signer.",
    accent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6M9 13h6M9 17h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/submissions",
    title: "Submissions",
    desc: "Track signing progress, copy signing links, download signed PDFs.",
    accent: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <path d="M5 4h14M5 12h14M5 20h14" strokeLinecap="round" />
        <circle cx="3.5" cy="4" r="1" />
        <circle cx="3.5" cy="12" r="1" />
        <circle cx="3.5" cy="20" r="1" />
      </svg>
    ),
  },
  {
    href: "/settings",
    title: "Settings",
    desc: "API tokens, webhooks, and account preferences.",
    accent: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .67.39 1.27 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.24.61.84 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function DashboardPage() {
  return (
    <LoginGate>
      <AppHeader />
      <main className="max-w-5xl mx-auto p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-zinc-500 mt-1">Everything you need to send a document for signing.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FOLDERS.map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors"
            >
              <div
                className={`inline-flex items-center justify-center h-10 w-10 rounded-lg ${f.accent}`}
              >
                {f.icon}
              </div>
              <h2 className="mt-4 font-semibold group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                {f.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 leading-relaxed">{f.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </LoginGate>
  );
}
