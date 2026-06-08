/** Smart-precision currency formatter — surfaces sub-cent deductions. */
export function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  if (amount < 0.01) return `$${amount.toFixed(5)}`;
  if (amount < 10) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
