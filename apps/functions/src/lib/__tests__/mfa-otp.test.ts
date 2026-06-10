/**
 * Unit tests for the pure WhatsApp OTP helpers (mfa-otp.ts).
 * No Firestore/Firebase involved — verification, hashing, send-gating only.
 */

import {
  canSendOtp,
  generateOtpCode,
  hashOtp,
  verifyOtp,
  type OtpRecord,
} from "../mfa-otp";

const NOW = 1_700_000_000_000;

function makeRecord(overrides: Partial<OtpRecord> = {}): OtpRecord {
  return {
    codeHash: hashOtp("123456"),
    expiresAt: NOW + 300_000,
    attempts: 0,
    maxAttempts: 3,
    purpose: "login",
    lastSentAt: null,
    sendCount: 0,
    sendWindowStart: null,
    ...overrides,
  };
}

describe("generateOtpCode", () => {
  it("returns a 6-digit numeric string", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    }
  });
});

describe("hashOtp", () => {
  it("is deterministic for the same input", () => {
    expect(hashOtp("123456")).toBe(hashOtp("123456"));
  });

  it("differs for different inputs", () => {
    expect(hashOtp("123456")).not.toBe(hashOtp("654321"));
  });
});

describe("verifyOtp", () => {
  it("returns ok for a correct, unexpired, in-purpose code", () => {
    const result = verifyOtp("123456", makeRecord(), "login", NOW);
    expect(result).toEqual({ ok: true });
  });

  it("returns expired when now is past expiresAt", () => {
    const record = makeRecord({ expiresAt: NOW - 1 });
    const result = verifyOtp("123456", record, "login", NOW);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("accepts Firestore Timestamp-like expiresAt", () => {
    const record = makeRecord({ expiresAt: { toMillis: () => NOW + 1000 } });
    expect(verifyOtp("123456", record, "login", NOW)).toEqual({ ok: true });
  });

  it("returns locked when attempts >= maxAttempts", () => {
    const record = makeRecord({ attempts: 3, maxAttempts: 3 });
    const result = verifyOtp("123456", record, "login", NOW);
    expect(result).toEqual({ ok: false, reason: "locked" });
  });

  it("returns wrong_purpose when an enroll code is used for login", () => {
    const record = makeRecord({ purpose: "enroll" });
    const result = verifyOtp("123456", record, "login", NOW);
    expect(result).toEqual({ ok: false, reason: "wrong_purpose" });
  });

  it("returns wrong_purpose when a login code is used for enroll", () => {
    const record = makeRecord({ purpose: "login" });
    const result = verifyOtp("123456", record, "enroll", NOW);
    expect(result).toEqual({ ok: false, reason: "wrong_purpose" });
  });

  it("returns mismatch with attemptsLeft on a wrong code", () => {
    const record = makeRecord({ attempts: 0, maxAttempts: 3 });
    const result = verifyOtp("000000", record, "login", NOW);
    expect(result).toEqual({ ok: false, reason: "mismatch", attemptsLeft: 2 });
  });

  it("clamps attemptsLeft at 0 on the last allowed attempt", () => {
    const record = makeRecord({ attempts: 2, maxAttempts: 3 });
    const result = verifyOtp("000000", record, "login", NOW);
    expect(result).toEqual({ ok: false, reason: "mismatch", attemptsLeft: 0 });
  });
});

describe("canSendOtp", () => {
  it("allows the first send when record is null", () => {
    expect(canSendOtp(null, NOW)).toEqual({ ok: true });
  });

  it("blocks with cooldown when within the resend window", () => {
    const record = makeRecord({ lastSentAt: NOW - 10_000 }); // 10s ago, default cooldown 60s
    const result = canSendOtp(record, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("cooldown");
      expect(result.retryAfterSeconds).toBe(50);
    }
  });

  it("allows after the cooldown elapsed", () => {
    const record = makeRecord({ lastSentAt: NOW - 61_000 });
    expect(canSendOtp(record, NOW)).toEqual({ ok: true });
  });

  it("blocks with hourly_cap when sendCount reached the cap in-window", () => {
    const record = makeRecord({
      lastSentAt: NOW - 120_000, // past cooldown
      sendCount: 5,
      sendWindowStart: NOW - 600_000, // 10 min ago, within the hour
    });
    const result = canSendOtp(record, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("hourly_cap");
    }
  });

  it("allows once the hourly window has rolled over", () => {
    const record = makeRecord({
      lastSentAt: NOW - 120_000,
      sendCount: 5,
      sendWindowStart: NOW - 3_700_000, // > 1h ago
    });
    expect(canSendOtp(record, NOW)).toEqual({ ok: true });
  });
});
