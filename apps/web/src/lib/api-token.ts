import crypto from "node:crypto";

const PREFIX = "unisi_";

export function newApiToken(): { plaintext: string; hash: string } {
  const random = crypto.randomBytes(32).toString("base64url");
  const plaintext = `${PREFIX}${random}`;
  const hash = hashToken(plaintext);
  return { plaintext, hash };
}

export function hashToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}
