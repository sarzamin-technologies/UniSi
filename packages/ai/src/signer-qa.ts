import type { SignerToken } from "@unisi/agnic";
import { DEFAULT_FRONTIER_MODEL, isAllowedFrontierModel } from "@unisi/shared";
import { createAgnicClient, Models, rethrowIf402 } from "./client";

export interface DocumentContext {
  filename: string;
  pages: { pageIndex: number; text: string }[];
}

export interface SignerAskInput {
  signerToken: SignerToken;
  documents: DocumentContext[];
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
  /** OpenRouter model slug. Validated against the curated frontier list;
   * unknown values fall back to the default. */
  model?: string;
}

export interface SignerCitation {
  filename: string;
  page: number;
  snippet: string;
}

export interface SignerAskOutput {
  answer: string;
  citations: SignerCitation[];
}

const SYSTEM_PROMPT = `You are a careful legal-document assistant helping a person who is about to sign a document understand what they are agreeing to.

Rules:
1. Answer ONLY based on the document content provided. If the document does not address the question, say so explicitly — do not speculate.
2. Quote or paraphrase specific clauses when answering, and cite the page number.
3. If you find unusual or unfavorable terms (auto-renewal, broad indemnification, non-competes, mandatory arbitration, large penalties, broad data sharing, etc.), proactively flag them in your answer.
4. Keep answers concise and plain-language. Avoid legalese.
5. You are NOT giving legal advice. Suggest the person consult a lawyer for high-stakes questions.

Output format: respond with valid JSON of shape:
{ "answer": "<plain prose answer>", "citations": [{ "filename": "<doc name>", "page": <1-based page>, "snippet": "<<= 200 chars verbatim>" }] }`;

function buildContextText(docs: DocumentContext[]): string {
  return docs
    .map((doc) => {
      const pages = doc.pages
        .filter((p) => p.text.length > 0)
        .map((p) => `[Page ${p.pageIndex + 1}]\n${p.text}`)
        .join("\n\n");
      return `=== ${doc.filename} ===\n${pages}`;
    })
    .join("\n\n");
}

export async function answerSignerQuestion(input: SignerAskInput): Promise<SignerAskOutput> {
  const client = createAgnicClient(input.signerToken, { kind: "signer" });
  const context = buildContextText(input.documents);

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Document content (verbatim text extracted from PDF):\n\n${context}\n\n---\nQuestion: ${input.question}`,
    },
    ...(input.history ?? []),
  ];

  const model =
    input.model && isAllowedFrontierModel(input.model)
      ? input.model
      : DEFAULT_FRONTIER_MODEL;

  let raw = "";
  try {
    const completion = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      // Legal answers with several verbatim citations routinely exceed 1k
      // tokens; truncation cuts the JSON mid-object and the prose can't be
      // recovered cleanly. Give the model room to close the object.
      max_tokens: 2048,
    });
    raw = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    rethrowIf402(err, "signer");
  }
  void Models;

  return safeParseAnswer(raw);
}

function safeParseAnswer(raw: string): SignerAskOutput {
  let obj: unknown = null;
  try {
    obj = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        obj = JSON.parse(m[0]);
      } catch {
        // ignore
      }
    }
  }
  const answer =
    typeof (obj as { answer?: unknown })?.answer === "string"
      ? String((obj as { answer: string }).answer)
      : // Whole-JSON parse failed (often truncated mid-citations). Pull just
        // the prose `answer` field so the signer sees readable text rather
        // than a raw JSON dump rendered as a code block.
        extractAnswerField(raw) ??
        (raw.trim() || "I couldn't form an answer from the document.");
  const citationsRaw = (obj as { citations?: unknown })?.citations;
  const citations: SignerCitation[] = Array.isArray(citationsRaw)
    ? citationsRaw
        .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
        .map((c) => ({
          filename: typeof c.filename === "string" ? c.filename : "",
          page: typeof c.page === "number" ? c.page : 1,
          snippet: typeof c.snippet === "string" ? c.snippet.slice(0, 240) : "",
        }))
    : [];
  return { answer, citations };
}

/**
 * Extract the `"answer": "..."` string from a possibly-truncated JSON blob.
 * Handles the common case where the response hit the token cap after the
 * answer field but mid-citations, leaving the object unclosed.
 */
function extractAnswerField(raw: string): string | null {
  const captured = raw.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  if (captured === undefined) return null;
  try {
    return JSON.parse(`"${captured}"`) as string; // unescape \n, \" etc.
  } catch {
    return captured;
  }
}
