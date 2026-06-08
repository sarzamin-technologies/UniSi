import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getValidSignerAccessToken } from "@unisi/agnic";
import {
  getDb,
  submitter,
  submission,
  attachment,
  aiConversation,
} from "@unisi/db";
import { getBlob } from "@unisi/storage";
import { extractPdfText } from "@unisi/pdf";
import { answerSignerQuestion, InsufficientBalanceError } from "@unisi/ai";
import { getSignerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  question: z.string().min(1).max(1000),
  /** OpenRouter slug; server validates against the curated frontier list. */
  model: z.string().optional(),
});

/**
 * Slug-gated AI Q&A. Requires the signer to have authenticated with Agnic
 * — their own wallet pays. Returns 401 with `agnic_login_required` if not.
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const signerSession = await getSignerSession();
  const token = await getValidSignerAccessToken(signerSession);
  await signerSession.save();
  if (!token) {
    return NextResponse.json({ error: "agnic_login_required" }, { status: 401 });
  }

  const db = getDb();
  const sub = await db.query.submitter.findFirst({ where: eq(submitter.slug, params.slug) });
  if (!sub) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parent = await db.query.submission.findFirst({
    where: eq(submission.id, sub.submissionId),
  });
  if (!parent) return NextResponse.json({ error: "submission_missing" }, { status: 500 });

  const snapshot = parent.templateSnapshot as {
    documents: { attachmentId: string; filename: string; pageCount: number }[];
  };

  // Load + extract text from every document. PDF text extraction can throw on
  // exotic fonts/encodings — fail soft per-doc so the AI still gets useful
  // context from the rest, and so an extraction edge case doesn't 500 the
  // whole Q&A surface.
  const documents = [];
  for (const d of snapshot.documents) {
    const att = await db.query.attachment.findFirst({
      where: eq(attachment.id, d.attachmentId),
    });
    if (!att) continue;
    try {
      const bytes = await getBlob(att.s3Key);
      const pages = await extractPdfText(new Uint8Array(bytes));
      documents.push({ filename: d.filename, pages });
    } catch (err) {
      console.warn(`[ask] extractPdfText failed for ${d.filename}:`, err);
      documents.push({
        filename: d.filename,
        pages: [{ pageIndex: 0, text: "(text extraction unavailable for this document)" }],
      });
    }
  }

  // Pull existing conversation (last few turns) for context continuity.
  const existing = await db
    .select()
    .from(aiConversation)
    .where(eq(aiConversation.submitterId, sub.id))
    .limit(1);
  const prior = existing[0];
  const history = (prior?.messages as { role: "user" | "assistant"; content: string }[] | null) ?? [];

  try {
    const result = await answerSignerQuestion({
      signerToken: token,
      documents,
      question: parsed.data.question,
      model: parsed.data.model,
      history: history.slice(-6),
    });

    // Persist conversation messages.
    const updated = [
      ...history,
      { role: "user" as const, content: parsed.data.question },
      { role: "assistant" as const, content: result.answer },
    ];
    if (prior) {
      await db
        .update(aiConversation)
        .set({ messages: updated, updatedAt: new Date() })
        .where(eq(aiConversation.id, prior.id));
    } else {
      const firstDoc = snapshot.documents[0];
      await db.insert(aiConversation).values({
        submitterId: sub.id,
        documentId: firstDoc?.attachmentId ?? null,
        messages: updated,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 402 });
    }
    // Surface the actual reason in dev — too easy to lose otherwise behind a
    // generic 500.
    console.error("[ask] answerSignerQuestion failed:", err);
    return NextResponse.json(
      { error: "ai_failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
