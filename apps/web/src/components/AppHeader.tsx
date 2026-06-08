import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, account } from "@unisi/db";
import { getOwnerSession } from "@/lib/session";
import { TopUpButton } from "./TopUpButton";
import { LogoutButton } from "./LogoutButton";

/**
 * Header shared across signed-in app pages. Always exposes a Dashboard link
 * so users can hop back to the hub from any list/detail page, and surfaces
 * the signed-in account's email so it's clear which Agnic identity is
 * driving the session.
 */
export async function AppHeader() {
  const session = await getOwnerSession();
  let email: string | null = null;
  if (session.account_id) {
    const row = await getDb().query.account.findFirst({
      where: eq(account.id, session.account_id),
      columns: { email: true },
    });
    email = row?.email ?? null;
  }

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <Link href="/" className="font-semibold tracking-tight">
          UniSi
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">/</span>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Dashboard
        </Link>
      </div>
      <div className="flex items-center gap-4 min-w-0">
        {email && (
          <span
            className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-[220px]"
            title={email}
          >
            {email}
          </span>
        )}
        <TopUpButton />
        <LogoutButton />
      </div>
    </header>
  );
}
