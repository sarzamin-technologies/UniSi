import crypto from "node:crypto";
import { eq, asc, desc, sql } from "drizzle-orm";
import { auditEvent, getDb } from "@unisi/db";

/**
 * Append-only, hash-chained audit log.
 *
 *   hash = sha256(prev_hash || canonicalize(payload))
 *
 * Canonicalization is deterministic JSON via sorted keys; same input always
 * yields the same hash. The PDF certificate generation bakes the tail
 * of this chain into the final document.
 */

export type AuditPayload = Record<string, unknown>;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(",")}}`;
}

export async function appendAuditEvent(opts: {
  submissionId: string;
  submitterId?: string;
  type: string;
  payload: AuditPayload;
}): Promise<{ id: string; hash: string }> {
  const db = getDb();
  // Serialize appends per submission. Without this, two concurrent appends
  // (e.g. both signers opening the link at once) both read the same "latest"
  // hash and insert events that fork off it — permanently breaking the chain.
  // A transaction-scoped advisory lock keyed on the submission id makes the
  // read-latest + insert atomic relative to other appends for that submission.
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${opts.submissionId}))`);

    const [latest] = await tx
      .select({ hash: auditEvent.hash })
      .from(auditEvent)
      .where(eq(auditEvent.submissionId, opts.submissionId))
      .orderBy(desc(auditEvent.seq))
      .limit(1);

    const prevHash = latest?.hash ?? null;
    const enriched = {
      type: opts.type,
      submissionId: opts.submissionId,
      submitterId: opts.submitterId ?? null,
      payload: opts.payload,
    };
    const hashInput = (prevHash ?? "") + canonicalize(enriched);
    const hash = crypto.createHash("sha256").update(hashInput).digest("hex");

    const [row] = await tx
      .insert(auditEvent)
      .values({
        submissionId: opts.submissionId,
        submitterId: opts.submitterId,
        type: opts.type,
        payload: opts.payload,
        prevHash,
        hash,
      })
      .returning({ id: auditEvent.id });

    if (!row) throw new Error("audit insert failed");
    return { id: row.id, hash };
  });
}

/** Verify the entire chain for a submission. Returns the bad index, or -1 if intact. */
export async function verifyAuditChain(submissionId: string): Promise<number> {
  const db = getDb();
  const events = await db
    .select()
    .from(auditEvent)
    .where(eq(auditEvent.submissionId, submissionId))
    .orderBy(asc(auditEvent.seq));

  let prev: string | null = null;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    const enriched = {
      type: ev.type,
      submissionId: ev.submissionId,
      submitterId: ev.submitterId ?? null,
      payload: ev.payload,
    };
    const input: string = (prev ?? "") + canonicalize(enriched);
    const expected: string = crypto.createHash("sha256").update(input).digest("hex");
    if (expected !== ev.hash || ev.prevHash !== prev) return i;
    prev = ev.hash;
  }
  return -1;
}
