/**
 * Standalone, PAdES-signed audit-trail certificate.
 *
 * The signed documents stay clean (no certificate page burned in). Their
 * SHA-256 hashes are listed here instead, and this certificate PDF is signed
 * with the platform's PKCS#7 certificate so any tampering with the trail — or
 * with a signed document it references — is detectable, and the trail itself
 * validates as a digital signature in PDF readers (Adobe Acrobat).
 */
import fs from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { P12Signer } from "@signpdf/signer-p12";
import { SignPdf } from "@signpdf/signpdf";

export interface AuditTrailSigner {
  name: string;
  email: string;
  completedAt: string;
  ip?: string;
}

export interface AuditTrailDocument {
  filename: string;
  sha256: string;
}

export interface AuditTrailInput {
  submissionId: string;
  /** Final hash of the append-only audit chain for this submission. */
  finalHash: string;
  documents: AuditTrailDocument[];
  submitters: AuditTrailSigner[];
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const BOTTOM = 60;

/** Load the platform signing certificate (PKCS#12), or null if not configured.
 * Prefers `PLATFORM_SIGN_P12_BASE64` (a base64-encoded .p12 — ideal for
 * platform secrets like Railway/Fly) and falls back to a file at
 * `PLATFORM_SIGN_P12_PATH`. Signing degrades to an unsigned certificate when
 * absent so the completion pipeline never hard-fails on a missing cert. */
export function loadPlatformP12(): { buffer: Buffer; passphrase: string } | null {
  const passphrase = process.env.PLATFORM_SIGN_P12_PASSPHRASE ?? "";
  const b64 = process.env.PLATFORM_SIGN_P12_BASE64;
  if (b64) {
    try {
      return { buffer: Buffer.from(b64, "base64"), passphrase };
    } catch (err) {
      console.warn("[audit-trail] invalid PLATFORM_SIGN_P12_BASE64:", err);
    }
  }
  const path = process.env.PLATFORM_SIGN_P12_PATH;
  if (!path) return null;
  try {
    return { buffer: fs.readFileSync(path), passphrase };
  } catch (err) {
    console.warn(`[audit-trail] could not read platform cert at ${path}:`, err);
    return null;
  }
}

/** Whether a platform signing certificate is configured + readable. */
export function platformSigningAvailable(): boolean {
  return loadPlatformP12() !== null;
}

/** Build the unsigned certificate PDF listing documents, hashes, and signers. */
async function buildAuditTrailPdf(input: AuditTrailInput): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setTitle(`UniSi Audit Trail — ${input.submissionId}`);
  doc.setProducer("UniSi");

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const line = (text: string, size = 10, font = helv, color = rgb(0, 0, 0), indent = 0) => {
    ensure(size + 6);
    page.drawText(text, { x: MARGIN + indent, y, size, font, color, maxWidth: PAGE_W - MARGIN * 2 - indent });
    y -= size + 6;
  };
  const gap = (n = 10) => {
    y -= n;
  };

  line("Certificate of Completion", 20, helvBold);
  gap(10);
  line(`Submission ID: ${input.submissionId}`);
  line(`Audit chain hash: ${input.finalHash}`);
  gap(8);

  line("Documents", 13, helvBold);
  gap(2);
  for (const d of input.documents) {
    line(d.filename, 10, helvBold);
    line(`SHA-256: ${d.sha256}`, 9, helv, rgb(0.4, 0.4, 0.4), 12);
    gap(4);
  }
  gap(6);

  line("Signers", 13, helvBold);
  gap(2);
  for (const s of input.submitters) {
    line(`${s.name || "(unnamed)"} <${s.email}>`);
    line(`signed at ${s.completedAt}${s.ip ? ` from ${s.ip}` : ""}`, 9, helv, rgb(0.4, 0.4, 0.4), 12);
    gap(6);
  }
  gap(8);

  line(
    "This certificate is digitally signed by the UniSi platform. The signed",
    8,
    helv,
    rgb(0.45, 0.45, 0.45),
  );
  line(
    "documents are stored separately; the SHA-256 hashes above bind them to this trail.",
    8,
    helv,
    rgb(0.45, 0.45, 0.45),
  );

  return doc;
}

/**
 * Build the audit-trail certificate and PAdES-sign it with the platform cert.
 * Returns `{ pdf, signed }` — `signed` is false when no platform cert is
 * configured (the PDF is still returned, just unsigned).
 */
export async function buildSignedAuditTrail(
  input: AuditTrailInput,
): Promise<{ pdf: Uint8Array; signed: boolean }> {
  const doc = await buildAuditTrailPdf(input);
  const p12 = loadPlatformP12();

  if (!p12) {
    console.warn(
      "[audit-trail] PLATFORM_SIGN_P12_PATH not set — producing UNSIGNED audit trail.",
    );
    return { pdf: await doc.save(), signed: false };
  }

  // Reserve the PKCS#7 placeholder, then sign. signpdf requires the cross-ref
  // table form, so disable object streams when saving.
  pdflibAddPlaceholder({
    pdfDoc: doc,
    reason: "UniSi signing-platform attestation of completion",
    contactInfo: "support@unisi.app",
    name: "UniSi Platform",
    location: "UniSi",
  });
  const withPlaceholder = Buffer.from(await doc.save({ useObjectStreams: false }));
  const signer = new P12Signer(p12.buffer, { passphrase: p12.passphrase });
  const signed = await new SignPdf().sign(withPlaceholder, signer);
  return { pdf: new Uint8Array(signed), signed: true };
}
