import { createHmac } from "crypto";
import { logger } from "../../lib/logger";

/** TTL for a confirmation token — 5 minutes is ample for a human to read and click confirm */
const TOKEN_TTL_MS = 5 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.CONFIRMATION_SECRET;
  if (secret) return secret;
  // Allow test/mock environments to work without the var configured
  if (process.env.NODE_ENV === "test" || process.env.AI_PROVIDER === "mock") {
    return "test-confirmation-secret-do-not-use-in-prod";
  }
  throw new Error("CONFIRMATION_SECRET env var not configured");
}

/**
 * Generate a short-lived HMAC confirmation token.
 *
 * The token binds to (sessionId, action) so it cannot be:
 * - Replayed across sessions (sessionId binding)
 * - Used to confirm a different action than what was shown (action binding)
 * - Used after TTL expires (expiresAt field, verified on validation)
 *
 * @param sessionId - AI session ID from the authenticated request
 * @param action    - Human-readable action label shown to the user in the confirmation dialog
 */
export function generateConfirmationToken(sessionId: string, action: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = `${sessionId}:${action}:${expiresAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  const data = JSON.stringify({ sessionId, action, expiresAt, sig });
  return Buffer.from(data).toString("base64url");
}

/**
 * Validate a confirmation token.
 * Returns true only when the token is structurally valid, unexpired, and bound to the given sessionId.
 * Never throws — invalid tokens always return false.
 */
export function validateConfirmationToken(token: string, sessionId: string): boolean {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString()) as {
      sessionId: string;
      action: string;
      expiresAt: number;
      sig: string;
    };
    const { sessionId: tSid, action, expiresAt, sig } = decoded;

    if (!tSid || tSid !== sessionId) return false;
    if (typeof expiresAt !== "number" || Date.now() > expiresAt) return false;

    const payload = `${tSid}:${action}:${expiresAt}`;
    const expectedSig = createHmac("sha256", getSecret()).update(payload).digest("hex");
    return sig === expectedSig;
  } catch {
    logger.warn("Malformed confirmation token received", { sessionId });
    return false;
  }
}
