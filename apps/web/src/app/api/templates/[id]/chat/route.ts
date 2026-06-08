import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, template } from "@unisi/db";
import { getValidOwnerAccessToken } from "@unisi/agnic";
import { createAgnicClient, Models, logOwnerCall, InsufficientBalanceError } from "@unisi/ai";
import { requireAccount } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

interface Field {
  type: string;
  label?: string;
  submitterRole: string;
  pageIndex: number;
}

interface Role {
  name: string;
  order: number;
}

// System prompt for AI-generated templates (bodyMarkdown present).
const aiDocSystemPrompt = (name: string, bodyMarkdown: string) =>
  `You are a concise assistant for the signing template "${name}". Answer only what the user asks.

Document (markdown):
---
${bodyMarkdown}
---

To suggest an edit output the COMPLETE updated markdown in one fenced code block, then one sentence explaining what changed. Keep all [FIELD: ...] placeholders intact unless the user asks to change them.`;

// System prompt for PDF / Google Doc templates (no markdown body available).
const pdfDocSystemPrompt = (
  name: string,
  filename: string | undefined,
  fields: Field[],
  roles: Role[],
) => {
  const roleList = roles.length ? roles.map((r) => r.name).join(", ") : "none";
  const fieldList =
    fields.length === 0
      ? "none"
      : fields
          .map((f) => `${f.type}${f.label ? ` "${f.label}"` : ""} → ${f.submitterRole} (p${f.pageIndex + 1})`)
          .join(", ");

  return `You are a concise assistant helping configure a signing template. Answer only what the user asks — do not output a full analysis unprompted.

Template: "${name}"${filename ? ` (${filename})` : ""}
Roles: ${roleList}
Fields: ${fieldList}

Available field types: signature, initials, date, text, number, email, phone, checkbox.
When asked, suggest specific fields with type, label, and role. Keep answers short.`;
};

function extractSuggestedMarkdown(text: string): string | undefined {
  const m = /```(?:markdown)?\n([\s\S]+?)```/.exec(text);
  return m?.[1]?.trim();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccount();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const message: string | undefined = body?.message;
  const history: { role: "user" | "assistant"; content: string }[] = body?.history ?? [];

  if (!message?.trim()) {
    return NextResponse.json({ error: "message_required" }, { status: 400 });
  }

  const db = getDb();
  const tmpl = await db.query.template.findFirst({
    where: and(eq(template.id, params.id), eq(template.accountId, auth.accountId)),
  });
  if (!tmpl) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const doc = (tmpl.documents as { bodyMarkdown?: string; filename?: string }[])?.[0];
  const isAiTemplate = Boolean(doc?.bodyMarkdown);

  const systemPrompt = isAiTemplate
    ? aiDocSystemPrompt(tmpl.name, doc!.bodyMarkdown!)
    : pdfDocSystemPrompt(
        tmpl.name,
        doc?.filename,
        (tmpl.fields as Field[]) ?? [],
        (tmpl.submitterRoles as Role[]) ?? [],
      );

  const accessToken = await getValidOwnerAccessToken(auth.accountId);
  const client = createAgnicClient(accessToken);

  try {
    const completion = await client.chat.completions.create({
      model: Models.draft,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message },
      ],
      max_tokens: 2048,
    });

    const answer = completion.choices[0]?.message?.content ?? "";
    const inputTokens = completion.usage?.prompt_tokens ?? 0;
    const outputTokens = completion.usage?.completion_tokens ?? 0;

    await logOwnerCall({
      accountId: auth.accountId,
      kind: "template_chat",
      model: Models.draft,
      inputTokens,
      outputTokens,
      status: "ok",
    });

    // Only offer edit suggestions for AI-generated templates that have markdown.
    const suggestedMarkdown = isAiTemplate ? extractSuggestedMarkdown(answer) : undefined;

    return NextResponse.json({ answer, suggestedMarkdown });
  } catch (err) {
    const is402 = err instanceof InsufficientBalanceError;
    await logOwnerCall({
      accountId: auth.accountId,
      kind: "template_chat",
      model: Models.draft,
      status: is402 ? "402" : "error",
      errorMessage: err instanceof Error ? err.message : "unknown",
    }).catch(() => undefined);
    if (is402) {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    return NextResponse.json({ error: "ai_error" }, { status: 500 });
  }
}
