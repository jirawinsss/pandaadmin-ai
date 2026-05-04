import "server-only";
import crypto from "node:crypto";

/**
 * Verify a LINE webhook signature.
 * LINE sends `x-line-signature: base64(HMAC-SHA256(rawBody, channelSecret))`.
 * Constant-time comparison to prevent timing attacks.
 */
export function verifyLineSignature(
  rawBody: string,
  signature: string,
  channelSecret: string,
): boolean {
  if (!signature || !channelSecret) return false;
  const expected = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody, "utf8")
    .digest("base64");
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

/**
 * Mask a credential for display in the UI.
 * Never log full tokens — call this before any console.log of stored values.
 */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim();
  if (v.length <= 8) return "•".repeat(v.length);
  return v.slice(0, 4) + "•".repeat(8) + v.slice(-4);
}
