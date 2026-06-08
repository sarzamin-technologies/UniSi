"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/session", { method: "DELETE" });
    window.location.href = "/";
  }
  return (
    <button
      type="button"
      onClick={handleLogout}
      className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
    >
      Sign out
    </button>
  );
}
