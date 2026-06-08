/**
 * Public verification of a UniSi audit-trail PDF.
 *
 * Checks two independent things:
 *   1. The audit trail's PAdES (PKCS#7) signature is intact and the bytes
 *      weren't altered — and, optionally, that it was signed by THIS instance's
 *      platform certificate (fingerprint pinning).
 *   2. The document hashes the (signed) trail asserts — so a caller can confirm
 *      a separately-supplied signed PDF matches one of them.
 *
 * No database access; pure crypto + parsing, safe to expose publicly.
 */
import crypto from "node:crypto";
import forge from "node-forge";
import { extractPdfText } from "./server-render";
import { loadPlatformP12 } from "./audit-trail";

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export interface AuditTrailVerification {
  signaturePresent: boolean;
  /** CMS signature verifies AND the signed content digest matches. */
  signatureValid: boolean;
  /** Signer certificate subject (e.g. "CN=UniSi Platform, O=UniSi"). */
  signerSubject?: string;
  /** SHA-256 fingerprint of the signer certificate. */
  signerFingerprint?: string;
  /** True when the signer cert matches this instance's configured platform cert. */
  matchesPlatformCert: boolean;
  /** Parsed from the (signed) trail body. */
  submissionId?: string;
  chainHash?: string;
  documents: { filename?: string; sha256: string }[];
  signers: { name: string; email: string; signedAt?: string; ip?: string }[];
  error?: string;
}

/** Locate a PDF signature: returns the signed byte range + the PKCS#7 DER. */
function extractSignature(pdfBytes: Uint8Array): { content: Buffer; der: Buffer } | null {
  const buf = Buffer.from(pdfBytes);
  const s = buf.toString("latin1");
  const br = s.match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/);
  const contents = s.match(/\/Contents\s*<([0-9A-Fa-f]+)>/);
  if (!br || !contents) return null;
  const a = Number(br[1]);
  const b = Number(br[2]);
  const c = Number(br[3]);
  const d = Number(br[4]);
  const content = Buffer.concat([buf.subarray(a, a + b), buf.subarray(c, c + d)]);

  // The placeholder is zero-padded; read the real DER length from its header.
  const full = Buffer.from(contents[1]!, "hex");
  const der = full.subarray(0, derTotalLength(full));
  return { content, der };
}

/** Total length of a DER object from its tag+length header. */
function derTotalLength(b: Buffer): number {
  if (b.length < 2 || b[0] !== 0x30) return b.length;
  const lenByte = b[1]!;
  if (lenByte < 0x80) return 2 + lenByte;
  const n = lenByte & 0x7f;
  let len = 0;
  for (let i = 0; i < n; i++) len = (len << 8) | b[2 + i]!;
  return 2 + n + len;
}

function certFingerprint(cert: forge.pki.Certificate): string {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const md = forge.md.sha256.create();
  md.update(der);
  return md.digest().toHex();
}

/** Verify a detached PKCS#7/CMS signature over `content`. */
function verifyDetached(content: Buffer, der: Buffer): {
  valid: boolean;
  signerSubject?: string;
  signerFingerprint?: string;
  error?: string;
} {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(der.toString("binary")));
    const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData & {
      rawCapture: { authenticatedAttributes?: forge.asn1.Asn1[]; signature?: string };
    };
    const cert = p7.certificates?.[0];
    if (!cert) return { valid: false, error: "no certificate in signature" };
    const signerSubject = cert.subject.attributes
      .map((a) => `${a.shortName ?? a.name}=${a.value as string}`)
      .join(", ");
    const signerFingerprint = certFingerprint(cert);

    const attrs = p7.rawCapture.authenticatedAttributes;
    const signature = p7.rawCapture.signature;
    if (!attrs || !signature) return { valid: false, signerSubject, signerFingerprint, error: "no signed attributes" };

    // 1) The messageDigest signed attribute must equal SHA-256(content).
    const contentMd = forge.md.sha256.create();
    contentMd.update(content.toString("binary"));
    const contentDigest = contentMd.digest().bytes();
    let claimedDigest: string | undefined;
    for (const attr of attrs) {
      const seq = attr as unknown as { value: { value: string }[] };
      const oid = forge.asn1.derToOid(seq.value[0]!.value);
      if (oid === forge.pki.oids.messageDigest) {
        claimedDigest = (seq.value[1] as unknown as { value: { value: string }[] }).value[0]!.value;
      }
    }
    const digestOk = claimedDigest !== undefined && claimedDigest === contentDigest;

    // 2) The signature must verify over the DER of the SET OF signed attributes.
    const set = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SET, true, attrs);
    const setDer = forge.asn1.toDer(set).getBytes();
    const sigMd = forge.md.sha256.create();
    sigMd.update(setDer);
    let sigOk = false;
    try {
      sigOk = (cert.publicKey as forge.pki.rsa.PublicKey).verify(sigMd.digest().bytes(), signature);
    } catch {
      sigOk = false;
    }

    return { valid: digestOk && sigOk, signerSubject, signerFingerprint };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "signature parse failed" };
  }
}

/** SHA-256 fingerprint of this instance's configured platform certificate, or
 * null if none is configured/readable. Used to pin the signer. */
export function platformCertFingerprint(): string | null {
  const p12 = loadPlatformP12();
  if (!p12) return null;
  try {
    const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12.buffer.toString("binary")));
    const store = forge.pkcs12.pkcs12FromAsn1(p12Asn1, p12.passphrase);
    const certBagOid = forge.pki.oids.certBag!;
    const bags = store.getBags({ bagType: certBagOid });
    const cert = bags[certBagOid]?.[0]?.cert;
    return cert ? certFingerprint(cert) : null;
  } catch {
    return null;
  }
}

/** Parse the visible (signed) text of the trail for its asserted facts. */
async function parseTrailText(trailBytes: Uint8Array): Promise<{
  submissionId?: string;
  chainHash?: string;
  documents: { sha256: string }[];
  signers: { name: string; email: string; signedAt?: string; ip?: string }[];
}> {
  const text = (await extractPdfText(trailBytes)).map((p) => p.text).join("\n");
  const submissionId = text.match(/Submission ID:\s*([0-9a-fA-F-]{36})/)?.[1];
  const chainHash = text.match(/Audit chain hash:\s*([0-9a-fA-F]{64})/)?.[1];
  const documents = Array.from(text.matchAll(/SHA-256:\s*([0-9a-fA-F]{64})/g)).map((m) => ({
    sha256: m[1]!.toLowerCase(),
  }));

  // Isolate the Signers section, then read each "name <email> signed at TS from IP".
  const section = text.split(/\bSigners\b/)[1]?.split(/This certificate/)[0] ?? "";
  const signers = Array.from(
    section.matchAll(
      /([^<>]+?)\s*<([^>\s]+@[^>\s]+)>\s*signed at\s*(\S+)(?:\s+from\s+(\S+))?/g,
    ),
  ).map((m) => ({
    name: m[1]!.trim(),
    email: m[2]!.trim(),
    signedAt: m[3],
    ip: m[4],
  }));
  return { submissionId, chainHash, documents, signers };
}

/** Full verification of an audit-trail PDF. */
export async function verifyAuditTrail(trailBytes: Uint8Array): Promise<AuditTrailVerification> {
  const sig = extractSignature(trailBytes);
  const parsed = await parseTrailText(trailBytes);

  if (!sig) {
    return {
      signaturePresent: false,
      signatureValid: false,
      matchesPlatformCert: false,
      documents: parsed.documents,
      signers: parsed.signers,
      submissionId: parsed.submissionId,
      chainHash: parsed.chainHash,
    };
  }

  const v = verifyDetached(sig.content, sig.der);
  const platformFp = platformCertFingerprint();
  return {
    signaturePresent: true,
    signatureValid: v.valid,
    signerSubject: v.signerSubject,
    signerFingerprint: v.signerFingerprint,
    matchesPlatformCert: platformFp != null && platformFp === v.signerFingerprint,
    submissionId: parsed.submissionId,
    chainHash: parsed.chainHash,
    documents: parsed.documents,
    signers: parsed.signers,
    error: v.error,
  };
}
