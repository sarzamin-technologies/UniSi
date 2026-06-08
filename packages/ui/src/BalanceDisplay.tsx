"use client";
import { formatCurrency } from "./formatCurrency";

export interface BalanceDisplayProps {
  balance: number | undefined;
  onTopUp?: () => void;
}

export function BalanceDisplay({ balance, onTopUp }: BalanceDisplayProps) {
  const formatted = balance !== undefined ? formatCurrency(balance) : "…";
  return (
    <button
      type="button"
      onClick={onTopUp}
      className="inline-flex items-center gap-1.5 text-sm font-medium px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
      title="Add funds"
    >
      <svg
        className="w-4 h-4 text-emerald-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7h18M3 7a2 2 0 00-2 2v8a2 2 0 002 2h18a2 2 0 002-2V9a2 2 0 00-2-2M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2M16 13h.01"
        />
      </svg>
      <span>{formatted}</span>
      {onTopUp && <span className="text-xs text-zinc-400">+</span>}
    </button>
  );
}
