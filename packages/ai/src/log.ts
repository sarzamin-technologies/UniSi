import { aiCallLog, getDb } from "@unisi/db";

/**
 * Owner-side AI call logging — for visibility into spend on the account
 * dashboard. Signer-side calls are NOT logged here (their spend is between
 * them and Agnic).
 */
export interface OwnerCallLogEntry {
  accountId: string;
  kind: "detect_fields" | "draft_template" | "extract_structured" | "answer_signer_question" | "template_chat";
  model: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  usd?: string | null;
  status: "ok" | "402" | "error";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export async function logOwnerCall(entry: OwnerCallLogEntry): Promise<void> {
  const db = getDb();
  await db.insert(aiCallLog).values({
    accountId: entry.accountId,
    kind: entry.kind,
    model: entry.model,
    inputTokens: entry.inputTokens ?? null,
    outputTokens: entry.outputTokens ?? null,
    usd: entry.usd ?? null,
    status: entry.status,
    errorMessage: entry.errorMessage,
    metadata: entry.metadata ?? {},
  });
}
