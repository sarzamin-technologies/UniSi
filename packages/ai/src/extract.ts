import { getValidOwnerAccessToken } from "@unisi/agnic";
import { createAgnicClient, Models, rethrowIf402 } from "./client";
import { logOwnerCall } from "./log";

export interface ExtractInput {
  accountId: string;
  documentText: string;
  /** All field labels collected from submitters, with their typed values. */
  fieldValues: Record<string, string | boolean | number | null>;
  /** Optional schema hint — if present, model is asked to fit values to this shape. */
  schema?: Record<string, "string" | "number" | "boolean" | "date">;
}

const SYSTEM = `You extract structured JSON from a completed digital signing transaction.

You are given:
1. The verbatim text of the signed document.
2. The values that submitters filled in for each labeled field.
3. (Optional) A target schema.

Output STRICT JSON containing the most useful structured data:
- Echo each labeled field value with a normalized snake_case key.
- Pull out parties, effective date, expiration date, monetary amounts, addresses, key obligations from the document text.
- Use ISO 8601 dates (YYYY-MM-DD).
- Numbers as numbers, not strings.
- If a value is unknowable, omit the key entirely — do NOT invent.

Output ONLY the JSON object. No prose.`;

export async function extractStructured(input: ExtractInput): Promise<Record<string, unknown>> {
  const token = await getValidOwnerAccessToken(input.accountId);
  const client = createAgnicClient(token);

  const userBlocks = [
    `=== Field values ===\n${JSON.stringify(input.fieldValues, null, 2)}`,
    input.schema
      ? `=== Target schema ===\n${JSON.stringify(input.schema, null, 2)}`
      : "",
    `=== Document text ===\n${input.documentText.slice(0, 50_000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const start = Date.now();
  let raw = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

  try {
    const completion = await client.chat.completions.create({
      model: Models.reasoning,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlocks },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1024,
    });
    raw = completion.choices[0]?.message?.content ?? "";
    usage = completion.usage;
  } catch (err) {
    await logOwnerCall({
      accountId: input.accountId,
      kind: "extract_structured",
      model: Models.reasoning,
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
      metadata: { ms: Date.now() - start },
    });
    rethrowIf402(err, "owner");
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        parsed = {};
      }
    }
  }

  await logOwnerCall({
    accountId: input.accountId,
    kind: "extract_structured",
    model: Models.reasoning,
    status: "ok",
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    metadata: { keys: Object.keys(parsed).length, ms: Date.now() - start },
  });

  return parsed;
}
