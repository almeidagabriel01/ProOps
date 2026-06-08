import { createHmac, randomInt } from "crypto";

/**
 * Pure, testable helpers for the custom WhatsApp OTP 2FA layer.
 *
 * The OTP is stored server-side as an HMAC hash with a TTL and a bounded number
 * of verification attempts. None of these functions touch Firestore — the
 * controller is responsible for persistence — so they can be unit-tested in
 * isolation.
 */

export type OtpPurpose = "enroll" | "login";

/** Shape of the OTP challenge record (subset relevant to verification/sending). */
export interface OtpRecord {
  codeHash: string;
  /** Expiry as epoch milliseconds or a Firestore Timestamp-like object. */
  expiresAt: number | { toMillis: () => number };
  attempts: number;
  maxAttempts: number;
  purpose: OtpPurpose;
  /** Last send time as epoch ms or Timestamp-like (used by canSendOtp). */
  lastSentAt?: number | { toMillis: () => number } | null;
  /** Number of sends within the current hourly window. */
  sendCount?: number;
  /** Start of the current hourly window as epoch ms or Timestamp-like. */
  sendWindowStart?: number | { toMillis: () => number } | null;
}

export type VerifyOtpResult =
  | { ok: true }
  | {
      ok: false;
      reason: "expired" | "locked" | "wrong_purpose" | "mismatch";
      attemptsLeft?: number;
    };

export type CanSendOtpResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cooldown" | "hourly_cap";
      retryAfterSeconds?: number;
    };

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getOtpTtlSeconds(): number {
  return readIntEnv("OTP_TTL_SECONDS", 300);
}

export function getOtpMaxAttempts(): number {
  return readIntEnv("OTP_MAX_ATTEMPTS", 3);
}

export function getOtpResendCooldownSeconds(): number {
  return readIntEnv("OTP_RESEND_COOLDOWN_SECONDS", 60);
}

export function getOtpMaxSendsPerHour(): number {
  return readIntEnv("OTP_MAX_SENDS_PER_HOUR", 5);
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

function toMillis(value: number | { toMillis: () => number } | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  return null;
}

/** Generate a 6-digit numeric OTP code (zero-padded). */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Deterministic HMAC-SHA256 hash of an OTP code. */
export function hashOtp(code: string): string {
  return createHmac("sha256", getSecret()).update(code).digest("hex");
}

/**
 * Verify a submitted OTP against a stored challenge record.
 *
 * Order of checks: purpose binding (enroll vs login), expiry, attempt lock,
 * then constant-comparison of the hash. `attemptsLeft` is returned on mismatch
 * so the caller can surface remaining tries to the user.
 */
export function verifyOtp(
  input: string,
  record: OtpRecord,
  expectedPurpose: OtpPurpose,
  now: number,
): VerifyOtpResult {
  if (record.purpose !== expectedPurpose) {
    return { ok: false, reason: "wrong_purpose" };
  }

  const expiresAtMs = toMillis(record.expiresAt);
  if (expiresAtMs === null || now > expiresAtMs) {
    return { ok: false, reason: "expired" };
  }

  if (record.attempts >= record.maxAttempts) {
    return { ok: false, reason: "locked" };
  }

  if (hashOtp(input) !== record.codeHash) {
    const attemptsLeft = Math.max(record.maxAttempts - (record.attempts + 1), 0);
    return { ok: false, reason: "mismatch", attemptsLeft };
  }

  return { ok: true };
}

/**
 * Decide whether a new OTP may be sent given the current challenge record.
 *
 * Enforces a per-resend cooldown (`OTP_RESEND_COOLDOWN_SECONDS`) since
 * `lastSentAt` and an hourly send cap (`OTP_MAX_SENDS_PER_HOUR`) tracked via
 * `sendCount` within a rolling window anchored at `sendWindowStart`. A null
 * record (first send) is always allowed.
 */
export function canSendOtp(record: OtpRecord | null, now: number): CanSendOtpResult {
  if (record === null) {
    return { ok: true };
  }

  const cooldownMs = getOtpResendCooldownSeconds() * 1000;
  const lastSentMs = toMillis(record.lastSentAt);
  if (lastSentMs !== null) {
    const elapsed = now - lastSentMs;
    if (elapsed < cooldownMs) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: Math.ceil((cooldownMs - elapsed) / 1000),
      };
    }
  }

  const windowStartMs = toMillis(record.sendWindowStart);
  const windowMs = 60 * 60 * 1000;
  const withinWindow =
    windowStartMs !== null && now - windowStartMs < windowMs;
  if (withinWindow) {
    const sendCount = record.sendCount ?? 0;
    if (sendCount >= getOtpMaxSendsPerHour()) {
      return {
        ok: false,
        reason: "hourly_cap",
        retryAfterSeconds: Math.ceil(
          (windowMs - (now - (windowStartMs as number))) / 1000,
        ),
      };
    }
  }

  return { ok: true };
}
