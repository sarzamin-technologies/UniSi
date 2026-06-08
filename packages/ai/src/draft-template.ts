import { getValidOwnerAccessToken } from "@unisi/agnic";
import { createAgnicClient, Models, rethrowIf402 } from "./client";
import { logOwnerCall } from "./log";

export interface DraftedTemplate {
  title: string;
  /** Markdown body. All recipient inputs are embedded as `[TYPE: ...]`
   * placeholders — see the system prompt for the supported types. */
  body: string;
  roles: string[];
}

const SYSTEM = `You draft professional documents that another party will then sign electronically.

Output STRICT JSON with this shape:
{
  "title": "<short doc title>",
  "body":  "<markdown body — see placeholder rules below>",
  "roles": ["Sender", "Signer", ...]
}

EVERY input that a recipient must provide MUST be embedded inline in the body
using one of these bracket placeholders. They render as labeled underlines
in the PDF and are turned into template fields automatically — DO NOT use
\`{{LABEL}}\` curly placeholders, they would be rendered as literal text.

  [SIGNATURE: Role]
  [INITIALS: Role]
  [DATE: Role]
  [TEXT: "Field label", Role]
  [NUMBER: "Field label", Role]
  [EMAIL: "Field label", Role]
  [PHONE: "Field label", Role]
  [CHECKBOX: "Field label", Role]

Rules:
- Plain markdown only — no HTML.
- Each placeholder must appear on its own line where the recipient fills it.
- Always include at least one [SIGNATURE: <role>] per signing party, usually
  with a [DATE: <role>] alongside.
- For inline blanks (party names, effective date, dollar amount, etc.) emit
  a [TEXT: "Effective date", Sender] line in the body. There is NO separate
  fields[] array — every field is a placeholder inline.
- Be concrete with the surrounding prose: real clauses, recital paragraphs,
  jurisdiction language, etc. The placeholders are the only bits left blank.
- Output ONLY the JSON. No surrounding prose.`;

export async function draftTemplate(input: {
  accountId: string;
  prompt: string;
}): Promise<DraftedTemplate> {
  const token = await getValidOwnerAccessToken(input.accountId);
  const client = createAgnicClient(token);

  const start = Date.now();
  let raw = "";
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

  try {
    const completion = await client.chat.completions.create({
      model: Models.draft,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: input.prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });
    raw = completion.choices[0]?.message?.content ?? "";
    usage = completion.usage;
  } catch (err) {
    await logOwnerCall({
      accountId: input.accountId,
      kind: "draft_template",
      model: Models.draft,
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
      metadata: { ms: Date.now() - start },
    });
    rethrowIf402(err, "owner");
  }

  const parsed = parseDraft(raw);

  await logOwnerCall({
    accountId: input.accountId,
    kind: "draft_template",
    model: Models.draft,
    status: "ok",
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    metadata: {
      titleLen: parsed.title.length,
      bodyLen: parsed.body.length,
      roles: parsed.roles.length,
      ms: Date.now() - start,
    },
  });

  return parsed;
}

function parseDraft(raw: string): DraftedTemplate {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("model returned non-JSON output");
    obj = JSON.parse(m[0]);
  }
  const o = (obj ?? {}) as Record<string, unknown>;
  const title = typeof o.title === "string" && o.title.length > 0 ? o.title : "Untitled document";
  const body = typeof o.body === "string" ? o.body : "";
  const rolesRaw = Array.isArray(o.roles) ? o.roles : [];
  const roles = rolesRaw
    .filter((r): r is string => typeof r === "string" && r.length > 0)
    .slice(0, 8);
  if (roles.length === 0) roles.push("Signer");

  return { title, body, roles };
}
