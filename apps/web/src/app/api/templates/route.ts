import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb, template } from "@unisi/db";
import { requireAccountOrToken } from "@/lib/auth-guard";
import { createTemplateFromPdf, MAX_PDF_BYTES } from "@/lib/template-create";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;
  const db = getDb();
  const rows = await db
    .select({
      id: template.id,
      name: template.name,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      documents: template.documents,
      fields: template.fields,
    })
    .from(template)
    .where(eq(template.accountId, auth.accountId))
    .orderBy(desc(template.createdAt))
    .limit(100);
  return NextResponse.json({ templates: rows });
}

export async function POST(req: NextRequest) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "only application/pdf is supported" }, { status: 415 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await createTemplateFromPdf({
    accountId: auth.accountId,
    buf,
    filename: file.name,
    name,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ template: result.template }, { status: 201 });
}
