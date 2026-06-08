/**
 * Stable color assignment for submitter roles. Used by both the template
 * builder (per-role field overlays) and the signing form (current vs other
 * signers). The default "Signer" role pins to emerald (matches the rest of
 * the UI); everything else hashes into the palette.
 */

export interface RoleColor {
  /** Solid CSS color, e.g. for borders + label backgrounds. */
  border: string;
  /** Translucent fill, used inside the field rectangle. */
  fill: string;
  /** Strong text color, used on chips and hover states. */
  text: string;
  /** Tailwind-friendly accent name (display only). */
  name: string;
}

const PALETTE: RoleColor[] = [
  { name: "emerald", border: "#10b981", fill: "rgba(16, 185, 129, 0.18)", text: "#047857" },
  { name: "sky",     border: "#0ea5e9", fill: "rgba(14, 165, 233, 0.18)", text: "#0369a1" },
  { name: "amber",   border: "#f59e0b", fill: "rgba(245, 158, 11, 0.18)", text: "#b45309" },
  { name: "purple",  border: "#a855f7", fill: "rgba(168, 85, 247, 0.18)", text: "#7e22ce" },
  { name: "rose",    border: "#f43f5e", fill: "rgba(244, 63, 94, 0.18)", text: "#be123c" },
  { name: "cyan",    border: "#06b6d4", fill: "rgba(6, 182, 212, 0.18)", text: "#0e7490" },
  { name: "indigo",  border: "#6366f1", fill: "rgba(99, 102, 241, 0.18)", text: "#4338ca" },
  { name: "pink",    border: "#ec4899", fill: "rgba(236, 72, 153, 0.18)", text: "#be185d" },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function colorForRole(role: string): RoleColor {
  if (!role) return PALETTE[0]!;
  if (role === "Signer") return PALETTE[0]!;
  return PALETTE[hash(role) % PALETTE.length]!;
}
