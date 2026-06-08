import crypto from "node:crypto";
import { getValidOwnerAccessToken } from "@unisi/agnic";
import { createAgnicClient, Models, rethrowIf402 } from "./client";
import { logOwnerCall } from "./log";

export interface DetectedField {
  type: "text" | "signature" | "initials" | "date" | "checkbox" | "number";
  pageIndex: number;
  /** Normalized [0,1] top-left origin coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  submitterRole: string;
  required: boolean;
  confidence: number;
}

interface DetectInput {
  accountId: string;
  pages: { pageIndex: number; png: Buffer; widthPx: number; heightPx: number }[];
  /** Default role to assign when the model can't infer one. */
  defaultRole?: string;
  /** Existing role names. The model is asked to reuse these exact names
   * when a field belongs to one of them (so AI detection on a re-upload
   * doesn't drift from "Tenant" to "Renter"). Empty array = freely name
   * parties from document context. */
  existingRoles?: string[];
}

function buildPrompt(existingRoles: string[]): string {
  const rolesHint =
    existingRoles.length > 0
      ? `This document already has these signer roles defined — REUSE these exact names when a field belongs to one of them: ${existingRoles.map((r) => `"${r}"`).join(", ")}. Only invent a new role name if a field clearly belongs to a party not in this list.`
      : `If the document involves multiple parties (e.g. Buyer/Seller, Tenant/Landlord, Employee/Employer, Client/Provider), assign each input field to the appropriate party and use that party name as the role. Use a single role like "Signer" only when there is one signing party.`;

  return `You are looking at images of document pages for digital signing. Identify regions where a recipient is expected to PROVIDE input — signature lines, initials slots, date blanks, name/email fields, and checkboxes.

Return ONLY a JSON object of the shape:
{
  "fields": [
    {
      "type": "signature" | "initials" | "date" | "text" | "number" | "checkbox",
      "pageIndex": <0-based page number>,
      "x": <left edge, 0..1>,
      "y": <top edge, 0..1>,
      "w": <width, 0..1>,
      "h": <height, 0..1>,
      "label": <short label inferred from nearby text, optional>,
      "role": <party/role name from the document context>,
      "required": <true|false>,
      "confidence": <0..1>
    }
  ]
}

Coordinates are normalized [0,1] with the ORIGIN AT THE TOP-LEFT of each page. Be conservative — only return fields you are confident about. Do not include fields that are already filled in. Prefer tight bounding boxes around the input area itself, not surrounding text.

PARTY ATTRIBUTION:
${rolesHint}
Read nearby labels carefully — "Tenant signature" → role "Tenant"; "Landlord initials" → role "Landlord"; "Buyer:" with a date blank → role "Buyer". Two signature blocks side by side typically belong to different parties. Keep role names short, capitalized, in English.`;
}

export async function detectFields(input: DetectInput): Promise<DetectedField[]> {
  const token = await getValidOwnerAccessToken(input.accountId);
  const client = createAgnicClient(token);

  const content = [
    { type: "text" as const, text: buildPrompt(input.existingRoles ?? []) },
    ...input.pages.map((p) => ({
      type: "image_url" as const,
      image_url: { url: `data:image/png;base64,${p.png.toString("base64")}` },
    })),
  ];

  const start = Date.now();
  let raw: string;
  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;

  try {
    const completion = await client.chat.completions.create({
      model: Models.vision,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      max_tokens: 4096,
    });
    raw = completion.choices[0]?.message?.content ?? "";
    usage = completion.usage;
  } catch (err) {
    await logOwnerCall({
      accountId: input.accountId,
      kind: "detect_fields",
      model: Models.vision,
      status: "error",
      errorMessage: err instanceof Error ? err.message : String(err),
      metadata: { pages: input.pages.length, ms: Date.now() - start },
    });
    rethrowIf402(err, "owner");
  }

  const parsed = safeParseFields(raw, input.defaultRole ?? "Signer");

  await logOwnerCall({
    accountId: input.accountId,
    kind: "detect_fields",
    model: Models.vision,
    status: "ok",
    inputTokens: usage?.prompt_tokens,
    outputTokens: usage?.completion_tokens,
    metadata: { pages: input.pages.length, fieldsDetected: parsed.length, ms: Date.now() - start },
  });

  return parsed;
}

function safeParseFields(raw: string, defaultRole: string): DetectedField[] {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    // Sometimes models wrap JSON in prose — try to find the first {...} block.
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return [];
    }
  }
  const fields = (obj as { fields?: unknown[] })?.fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .filter(
      (f): f is Record<string, unknown> =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as Record<string, unknown>).type === "string" &&
        typeof (f as Record<string, unknown>).pageIndex === "number" &&
        typeof (f as Record<string, unknown>).x === "number",
    )
    .map((f) => normalizeField(f, defaultRole))
    .filter((f): f is DetectedField => f !== null);
}

function normalizeField(f: Record<string, unknown>, defaultRole: string): DetectedField | null {
  const type = String(f.type);
  if (!["signature", "initials", "date", "text", "number", "checkbox"].includes(type)) return null;
  const pageIndex = Number(f.pageIndex);
  const x = clamp(Number(f.x), 0, 1);
  const y = clamp(Number(f.y), 0, 1);
  const w = clamp(Number(f.w), 0, 1 - x);
  const h = clamp(Number(f.h), 0, 1 - y);
  if (!Number.isFinite(x + y + w + h) || w <= 0 || h <= 0) return null;
  return {
    type: type as DetectedField["type"],
    pageIndex,
    x,
    y,
    w,
    h,
    label: typeof f.label === "string" ? f.label : undefined,
    submitterRole: typeof f.role === "string" && f.role.length > 0 ? String(f.role) : defaultRole,
    required: f.required === false ? false : true,
    confidence: clamp(Number(f.confidence ?? 0.7), 0, 1),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, v));
}

/** Convert AI-detected fields to template field schema (assigns UUIDs). */
export function detectedToTemplateFields(detected: DetectedField[]): {
  id: string;
  type: DetectedField["type"];
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  submitterRole: string;
  label?: string;
}[] {
  return detected.map((f) => ({
    id: crypto.randomUUID(),
    type: f.type,
    pageIndex: f.pageIndex,
    x: f.x,
    y: f.y,
    w: f.w,
    h: f.h,
    required: f.required,
    submitterRole: f.submitterRole,
    label: f.label,
  }));
}
