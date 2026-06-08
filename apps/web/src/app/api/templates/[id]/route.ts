import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, template } from "@unisi/db";
import { FieldSchema, SubmitterRoleSchema } from "@unisi/shared";
import { requireAccountOrToken } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const UpdateTemplateBody = z.object({
  name: z.string().min(1).max(200).optional(),
  fields: z.array(FieldSchema).optional(),
  submitterRoles: z.array(SubmitterRoleSchema).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccountOrToken(_req);
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const row = await db.query.template.findFirst({
    where: and(eq(template.id, params.id), eq(template.accountId, auth.accountId)),
  });
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ template: row });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const body = UpdateTemplateBody.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body", issues: body.error.issues }, { status: 400 });
  }
  const db = getDb();
  const [updated] = await db
    .update(template)
    .set({
      ...(body.data.name !== undefined && { name: body.data.name }),
      ...(body.data.fields !== undefined && { fields: body.data.fields }),
      ...(body.data.submitterRoles !== undefined && {
        submitterRoles: body.data.submitterRoles,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(template.id, params.id), eq(template.accountId, auth.accountId)))
    .returning();
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ template: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAccountOrToken(_req);
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const [deleted] = await db
    .delete(template)
    .where(and(eq(template.id, params.id), eq(template.accountId, auth.accountId)))
    .returning({ id: template.id });
  if (!deleted) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
