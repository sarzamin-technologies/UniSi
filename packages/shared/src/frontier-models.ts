/**
 * Curated list of frontier chat models exposed to signers via the AI Q&A
 * panel. The IDs are the OpenRouter slugs Agnic's gateway accepts. The first
 * entry is the default when no preference is stored.
 */

export interface FrontierModel {
  id: string;
  label: string;
  family: "anthropic" | "openai" | "google" | "xai" | "deepseek" | "meta" | "mistral";
  /** One-line summary surfaced in the picker tooltip. */
  blurb: string;
  /** Strongest cost/perf trade-off note for this slot. */
  tier: "flagship" | "balanced" | "fast" | "reasoning";
}

export const FRONTIER_MODELS: FrontierModel[] = [
  {
    id: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    family: "anthropic",
    tier: "balanced",
    blurb: "Anthropic's balanced flagship — strongest default for legal text",
  },
  {
    id: "anthropic/claude-opus-4.5",
    label: "Claude Opus 4.5",
    family: "anthropic",
    tier: "flagship",
    blurb: "Anthropic's deepest reasoning model — best for nuanced clauses",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5",
    family: "anthropic",
    tier: "fast",
    blurb: "Fastest Claude — sub-second answers at low cost",
  },
  {
    id: "openai/gpt-5",
    label: "GPT-5",
    family: "openai",
    tier: "flagship",
    blurb: "OpenAI's flagship — strong instruction-following",
  },
  {
    id: "openai/gpt-5-mini",
    label: "GPT-5 mini",
    family: "openai",
    tier: "fast",
    blurb: "Smaller GPT-5 — fast and inexpensive",
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    family: "openai",
    tier: "balanced",
    blurb: "Multimodal generalist — proven on long contracts",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    family: "google",
    tier: "flagship",
    blurb: "Google's flagship — huge context window for long docs",
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    family: "google",
    tier: "fast",
    blurb: "Lightweight Gemini — quickest answers from Google",
  },
  {
    id: "xai/grok-4",
    label: "Grok 4",
    family: "xai",
    tier: "balanced",
    blurb: "xAI's flagship — direct, less verbose responses",
  },
  {
    id: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    family: "deepseek",
    tier: "reasoning",
    blurb: "Open-weights reasoning specialist — shows its work",
  },
];

export const DEFAULT_FRONTIER_MODEL = FRONTIER_MODELS[0]!.id;

/** Type-guard for incoming user-supplied model IDs. */
export function isAllowedFrontierModel(id: string): boolean {
  return FRONTIER_MODELS.some((m) => m.id === id);
}
