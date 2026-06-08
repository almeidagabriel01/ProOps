import { createHmac, randomUUID } from "crypto";
import { logger } from "./logger";

const DEFAULT_TTL_SECONDS = 1800;

function getSecret(): string {
  const secret = process.env.MFA_RECOVERY_SECRET;
  if (secret) return secret;
  // Allow test environments to work without the var configured.
  if (process.env.NODE_ENV === "test") {
    return "test-mfa-recovery-secret-do-not-use-in-prod";
  }
  throw new Error("MFA_RECOVERY_SECRET env var not configured");
}

function getTtlMs(): number {
  const raw = Number(process.env.MFA_RECOVERY_TTL_SECONDS);
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_SECONDS;
  return seconds * 1000;
}

/**
 * Generate a short-lived HMAC recovery token for a self-service MFA recovery.
 *
 * The token binds to (uid, tokenId) so it cannot be:
 * - Forged without the secret (HMAC signature)
 * - Used after TTL expires (expiresAt field, verified on parse)
 *
 * Single-use is enforced in Firestore via the `mfaRecoveryTokens/{tokenId}`
 * document (`used` flag), not by the token itself. The random `tokenId` is the
 * key used to match that document.
 */
export function generateRecoveryToken(uid: string): string {
  const tokenId = randomUUID();
  const expiresAt = Date.now() + getTtlMs();
  const payload = `${uid}:${tokenId}:${expiresAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  const data = JSON.stringify({ uid, tokenId, expiresAt, sig });
  return Buffer.from(data).toString("base64url");
}

/**
 * Validate a recovery token.
 * Returns the bound `{ uid, tokenId }` only when the token is structurally
 * valid, unexpired, and the signature matches. Never throws — invalid or
 * malformed tokens always return null.
 */
export function parseRecoveryToken(
  token: string,
): { uid: string; tokenId: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString()) as {
      uid: string;
      tokenId: string;
      expiresAt: number;
      sig: string;
    };
    const { uid, tokenId, expiresAt, sig } = decoded;

    if (!uid || typeof uid !== "string") return null;
    if (!tokenId || typeof tokenId !== "string") return null;
    if (typeof expiresAt !== "number" || Date.now() > expiresAt) return null;

    const payload = `${uid}:${tokenId}:${expiresAt}`;
    const expectedSig = createHmac("sha256", getSecret())
      .update(payload)
      .digest("hex");
    if (sig !== expectedSig) return null;

    return { uid, tokenId };
  } catch {
    logger.warn("Malformed MFA recovery token received");
    return null;
  }
}
