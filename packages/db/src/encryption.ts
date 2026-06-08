import crypto from "node:crypto";

/**
 * AES-256-GCM symmetric encryption for Agnic refresh+access tokens at rest.
 *
 * The key is derived from SESSION_SECRET via SHA-256 of `"agnic-tk" || secret`,
 * giving us a 32-byte subkey scoped to the agnic-token use case so the same
 * SESSION_SECRET can also feed iron-session without key reuse.
 *
 * Output format:  base64url( iv(12) || ciphertext || tag(16) )
 */

function deriveKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  const seed = Buffer.from(secret, "hex");
  if (seed.length < 32) {
    throw new Error("SESSION_SECRET must be at least 64 hex chars (32 bytes)");
  }
  return crypto.createHash("sha256").update("agnic-tk").update(seed).digest();
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

export async function encryptString(plaintext: string): Promise<string> {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64url");
}

export async function decryptString(encoded: string): Promise<string> {
  const buf = Buffer.from(encoded, "base64url");
  if (buf.length < IV_BYTES + TAG_BYTES) throw new Error("ciphertext too short");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);
  const ct = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
