import { eq } from "drizzle-orm";
import { account, getDb, type Account } from "@unisi/db";
import { persistOwnerTokens } from "@unisi/agnic";

/**
 * Look up (or create) an account by Agnic subject (DID). Persists the
 * freshly exchanged tokens. Updates email/name if the userinfo response
 * carried newer values. Returns the resolved account row.
 */
export async function upsertAccountFromAgnicLogin(opts: {
  agnicSubject: string;
  email?: string;
  name?: string;
  tokens: { access_token: string; refresh_token: string; expires_in: number };
}): Promise<Account> {
  const db = getDb();
  let row = await db.query.account.findFirst({
    where: eq(account.agnicSubject, opts.agnicSubject),
  });

  if (!row && opts.email) {
    // Migration aid: a pre-userinfo login may have created the account with
    // a transient hash-based subject but the same email. Adopt that row.
    const byEmail = await db.query.account.findFirst({ where: eq(account.email, opts.email) });
    if (byEmail) {
      const [updated] = await db
        .update(account)
        .set({
          agnicSubject: opts.agnicSubject,
          name: opts.name ?? byEmail.name,
          updatedAt: new Date(),
        })
        .where(eq(account.id, byEmail.id))
        .returning();
      if (updated) row = updated;
    }
  }

  if (!row) {
    const [inserted] = await db
      .insert(account)
      .values({
        agnicSubject: opts.agnicSubject,
        email: opts.email,
        name: opts.name,
      })
      .returning();
    if (!inserted) throw new Error("failed to create account");
    row = inserted;
  } else if (opts.email && row.email !== opts.email) {
    // Refresh email on file if it changed.
    const [updated] = await db
      .update(account)
      .set({ email: opts.email, name: opts.name ?? row.name, updatedAt: new Date() })
      .where(eq(account.id, row.id))
      .returning();
    if (updated) row = updated;
  }

  await persistOwnerTokens(row.id, opts.tokens);
  return row;
}
