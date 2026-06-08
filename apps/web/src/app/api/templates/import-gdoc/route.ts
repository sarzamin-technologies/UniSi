import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAccountOrToken } from "@/lib/auth-guard";
import { createTemplateFromPdf, MAX_PDF_BYTES } from "@/lib/template-create";

export const dynamic = "force-dynamic";

const Body = z.object({
  url: z.string().url().max(2000),
  name: z.string().max(200).optional(),
});

/**
 * Extract the Google Docs document id from any of the common share-link
 * shapes:
 *   https://docs.google.com/document/d/<ID>/edit?usp=sharing
 *   https://docs.google.com/document/d/<ID>
 *   https://docs.google.com/open?id=<ID>
 * Returns null for published-to-web links (/d/e/<ID>/pub) and anything that
 * isn't a docs.google.com document — those can't be exported as PDF the same
 * way, so we reject them with a clear message rather than fetching garbage.
 */
function parseGoogleDocId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.hostname !== "docs.google.com") return null;
  // Published links embed an "e/" segment we don't support.
  if (/\/document\/d\/e\//.test(u.pathname)) return null;
  const m = u.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m?.[1]) return m[1];
  const idParam = u.searchParams.get("id");
  if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) return idParam;
  return null;
}

/** Pull `filename="…"` out of a Content-Disposition header, if present. */
function filenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const star = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      /* fall through */
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() ?? null;
}

/**
 * Import a publicly-accessible Google Doc as a template. We never fetch the
 * user-supplied URL directly — we extract the doc id and request the fixed
 * Google export endpoint, which both normalizes the source and avoids SSRF.
 *
 * If the doc isn't shared publicly, Google serves its HTML sign-in page (not a
 * PDF); we detect that via the content type and return a 422 so the user knows
 * to fix the sharing setting rather than getting a corrupt template.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAccountOrToken(req);
  if (auth instanceof NextResponse) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const docId = parseGoogleDocId(parsed.data.url);
  if (!docId) {
    return NextResponse.json(
      {
        error:
          "Not a Google Docs link. Paste a URL like https://docs.google.com/document/d/…/edit",
      },
      { status: 400 },
    );
  }

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=pdf`;

  let res: Response;
  try {
    res = await fetch(exportUrl, { redirect: "follow" });
  } catch {
    return NextResponse.json({ error: "Couldn't reach Google Docs. Try again." }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          "Couldn't fetch the doc. Make sure link sharing is set to “Anyone with the link can view.”",
      },
      { status: 422 },
    );
  }

  // A non-public doc returns the Google sign-in page as HTML, not a PDF.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    return NextResponse.json(
      {
        error:
          "That doc isn't publicly accessible. Set link sharing to “Anyone with the link can view,” then try again.",
      },
      { status: 422 },
    );
  }

  // Guard size before buffering the whole response.
  const declaredLength = Number(res.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "Document is too large (max 25 MB)." }, { status: 413 });
  }

  const buf = Buffer.from(await res.arrayBuffer());

  const exportedName = filenameFromDisposition(res.headers.get("content-disposition"));
  const filename = (exportedName ?? `${parsed.data.name?.trim() || "Google Doc"}.pdf`).replace(
    /(\.pdf)?$/i,
    ".pdf",
  );

  const result = await createTemplateFromPdf({
    accountId: auth.accountId,
    buf,
    filename,
    name: parsed.data.name,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ template: result.template }, { status: 201 });
}
