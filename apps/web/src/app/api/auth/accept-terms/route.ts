import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, account } from "@unisi/db";
import { getOwnerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getOwnerSession();

  if (!session.account_id || !session.access_token) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const db = getDb();
  await db
    .update(account)
    .set({ termsAcceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(account.id, session.account_id));

  session.terms_accepted = true;
  await session.save();

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return NextResponse.redirect(`${APP_URL}/dashboard`);
}
