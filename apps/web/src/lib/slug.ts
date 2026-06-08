import crypto from "node:crypto";

/**
 * URL-safe submitter slug — collision-resistant and unguessable.
 * Length 22 → 132 bits of entropy.
 */
export function newSubmitterSlug(): string {
  return crypto.randomBytes(16).toString("base64url");
}
