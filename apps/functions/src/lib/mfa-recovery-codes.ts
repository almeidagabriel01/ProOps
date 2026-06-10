import { createHmac, randomInt } from "crypto";

/**
 * Pure, testable helpers for MFA recovery (backup) codes.
 *
 * Recovery codes follow the GitHub/Google pattern: single-use codes shown to
 * the user exactly once, stored server-side only as HMAC hashes. None of these
 * functions touch Firestore — the controller owns persistence — so they can be
 * unit-tested in isolation.
 */

/** Alphabet without visually ambiguous characters (no 0/o, 1/l/i). */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_SEGMENT_LENGTH = 4;

/** Shape of a stored recovery code hash with its consumption marker. */
export interface HashedRecoveryCode {
  hash: string;
  /** Null/undefined while unused; any non-null value marks it consumed. */
  usedAt: unknown;
}

function getSecret(): string {
  const secret = process.env.OTP_SECRET;
  if (secret) return secret;
  // Allow test/mock environments to work without the var configured.
  if (process.env.NODE_ENV === "test" || process.env.AI_PROVIDER === "mock") {
    return "test-otp-secret-do-not-use-in-prod";
  }
  throw new Error("OTP_SECRET env var not configured");
}

function randomSegment(): string {
  let segment = "";
  for (let i = 0; i < CODE_SEGMENT_LENGTH; i += 1) {
    segment += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return segment;
}

/**
 * Generate `count` unique recovery codes in the `xxxx-xxxx` format using an
 * unambiguous alphabet. Uniqueness is enforced within the returned batch.
 */
export function generateRecoveryCodes(count = 10): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(`${randomSegment()}-${randomSegment()}`);
  }
  return Array.from(codes);
}

/**
 * Normalize user input: lowercase, with spaces and hyphens stripped. Lets the
 * user paste a code with or without the hyphen and in any case.
 */
export function normalizeRecoveryCode(input: string): string {
  return input.toLowerCase().replace(/[\s-]/g, "");
}

/** Deterministic HMAC-SHA256 hash of a NORMALIZED recovery code. */
export function hashRecoveryCode(code: string): string {
  return createHmac("sha256", getSecret())
    .update(normalizeRecoveryCode(code))
    .digest("hex");
}

/**
 * Verify a submitted recovery code against the stored hashes. Only codes that
 * have NOT been used (`usedAt` is null/undefined) are considered. Returns the
 * index of the matching code or null. Pure — does not touch Firestore.
 */
export function verifyRecoveryCode(
  input: string,
  hashedCodes: HashedRecoveryCode[],
): { index: number } | null {
  const candidateHash = hashRecoveryCode(input);
  for (let index = 0; index < hashedCodes.length; index += 1) {
    const entry = hashedCodes[index];
    if (entry.usedAt !== null && entry.usedAt !== undefined) continue;
    if (entry.hash === candidateHash) {
      return { index };
    }
  }
  return null;
}
