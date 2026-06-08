import { NextRequest, NextResponse } from "next/server";
import { verifyAuditTrail, sha256Hex } from "@unisi/pdf";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Public verification endpoint. Upload a signed document + its audit-trail PDF;
 * confirms the trail's platform signature is intact and that the document's
 * SHA-256 is one the (signed) trail vouches for. No auth, no DB access.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart form data" }, { status: 400 });
  }

  const trail = form.get("auditTrail");
  const doc = form.get("document");
  if (!(trail instanceof File)) {
    return NextResponse.json({ error: "auditTrail file is required" }, { status: 400 });
  }
  if (trail.size > MAX_BYTES || (doc instanceof File && doc.size > MAX_BYTES)) {
    return NextResponse.json({ error: "file too large (max 25 MB)" }, { status: 413 });
  }

  const trailBytes = new Uint8Array(await trail.arrayBuffer());
  let trailResult;
  try {
    trailResult = await verifyAuditTrail(trailBytes);
  } catch (err) {
    return NextResponse.json(
      { error: "could not read audit trail PDF", detail: err instanceof Error ? err.message : String(err) },
      { status: 422 },
    );
  }

  let documentSha256: string | null = null;
  let documentMatches: boolean | null = null;
  if (doc instanceof File) {
    documentSha256 = sha256Hex(new Uint8Array(await doc.arrayBuffer()));
    documentMatches = trailResult.documents.some((d) => d.sha256 === documentSha256);
  }

  return NextResponse.json({
    document: doc instanceof File ? { filename: doc.name, sha256: documentSha256, matches: documentMatches } : null,
    trail: trailResult,
  });
}
