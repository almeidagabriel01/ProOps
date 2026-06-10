/**
 * Unit tests for whatsapp-mfa.controller.ts.
 *
 * Mocks Firestore (db), Firebase Auth (getUser), the WhatsApp template sender,
 * the logger and the security audit writer. Asserts: super-admin rejection,
 * that TOTP and WhatsApp can coexist (no exclusivity, no auto-reconcile),
 * happy-path enroll/verify, that phoneNumberIndex is NEVER written, and login
 * verification.
 */

const mockSet = jest.fn();
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockUpdate = jest.fn().mockResolvedValue(undefined);

// Per-collection in-memory document store keyed by `${collection}/${id}`.
const docStore = new Map<string, Record<string, unknown> | undefined>();

function docKey(collection: string, id: string): string {
  return `${collection}/${id}`;
}

function makeDocRef(collection: string, id: string) {
  return {
    get: jest.fn(async () => {
      const data = docStore.get(docKey(collection, id));
      return { exists: data !== undefined, data: () => data };
    }),
    set: jest.fn(async (value: Record<string, unknown>, options?: { merge?: boolean }) => {
      mockSet(collection, id, value, options);
      const existing = docStore.get(docKey(collection, id));
      docStore.set(
        docKey(collection, id),
        options?.merge ? { ...(existing ?? {}), ...value } : value,
      );
    }),
    update: jest.fn(async (value: Record<string, unknown>) => {
      mockUpdate(collection, id, value);
    }),
    delete: jest.fn(async () => {
      mockDelete(collection, id);
      docStore.delete(docKey(collection, id));
    }),
  };
}

// Minimal `where(field, ==, value).limit(n).get()` over the in-memory store,
// enough for the global phone-uniqueness query in isWhatsappMfaPhoneTaken.
function makeQuery(collection: string, field: string, value: unknown) {
  const matchAll = () => {
    const docs: Array<{ id: string; data: () => Record<string, unknown> | undefined }> = [];
    for (const [key, data] of docStore.entries()) {
      const slash = key.indexOf("/");
      const coll = key.slice(0, slash);
      const id = key.slice(slash + 1);
      if (coll === collection && data && data[field] === value) {
        docs.push({ id, data: () => data });
      }
    }
    return docs;
  };
  const build = (limitN?: number) => ({
    limit: (n: number) => build(n),
    get: jest.fn(async () => {
      const all = matchAll();
      return { docs: limitN ? all.slice(0, limitN) : all };
    }),
  });
  return build();
}

const mockCollection = jest.fn((collection: string) => ({
  doc: (id: string) => makeDocRef(collection, id),
  where: (field: string, _op: string, value: unknown) =>
    makeQuery(collection, field, value),
}));

const mockGetUser = jest.fn();

// Serializing runTransaction mock: Firestore commits transactions atomically and
// retries on conflict, so the observable outcome of two concurrent transactions
// is that they run one-at-a-time. Chaining each call after the previous models
// exactly that — the second transaction reads the first's committed write. The
// `tx` exposes get/set backed by the same in-memory doc refs as non-tx writes,
// so writeChallengeTx updates docStore (and mockSet) just like writeChallenge.
let mockTxChain: Promise<unknown> = Promise.resolve();
const mockRunTransaction = jest.fn(
  (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
    const tx = {
      get: (ref: { get: () => Promise<unknown> }) => ref.get(),
      set: (ref: { set: (v: unknown) => Promise<unknown> }, value: unknown) => {
        void ref.set(value);
      },
    };
    const result = mockTxChain.then(() => fn(tx));
    mockTxChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  },
);

jest.mock("../../../init", () => ({
  db: {
    collection: (name: string) => mockCollection(name),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockRunTransaction(fn),
  },
  auth: { getUser: (uid: string) => mockGetUser(uid) },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("../../../lib/security-observability", () => ({
  writeSecurityAuditEvent: jest.fn(),
}));

const mockSendTemplate = jest.fn().mockResolvedValue(undefined);
jest.mock("../../services/whatsapp/whatsapp.api", () => ({
  sendWhatsAppTemplate: (...args: unknown[]) => mockSendTemplate(...args),
}));

// FieldValue.delete sentinel — controller uses it on user-doc updates.
jest.mock("firebase-admin/firestore", () => {
  const actual = jest.requireActual("firebase-admin/firestore");
  return {
    ...actual,
    FieldValue: { delete: () => "__DELETE__", increment: (n: number) => ({ __inc: n }) },
    Timestamp: {
      fromMillis: (ms: number) => ({
        toMillis: () => ms,
        __ts: ms,
      }),
    },
  };
});

import type { Request, Response } from "express";
import {
  challengeWhatsappLogin,
  disableWhatsappMfa,
  startWhatsappEnroll,
  verifyWhatsappEnroll,
  verifyWhatsappLogin,
} from "../whatsapp-mfa.controller";
import { hashOtp } from "../../../lib/mfa-otp";

function makeReq(
  body: unknown,
  user: { uid: string; tenantId: string; isSuperAdmin?: boolean },
): Request {
  return {
    body,
    user,
    path: "/v1/auth/whatsapp-mfa/test",
    headers: {},
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock; set: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const set = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json, set } as unknown as Response;
  return { res, json, status, set };
}

const USER = { uid: "user-1", tenantId: "tenant-1" };
const PHONE_INPUT = "11999998888"; // normalizes to 5511999998888

beforeEach(() => {
  jest.clearAllMocks();
  docStore.clear();
  mockTxChain = Promise.resolve();
  process.env.WHATSAPP_OTP_TEMPLATE_NAME = "otp_template";
  // no TOTP factor by default
  mockGetUser.mockResolvedValue({ multiFactor: { enrolledFactors: [] } });
});

describe("startWhatsappEnroll", () => {
  it("rejects super admins with 403", async () => {
    const req = makeReq({ phone: PHONE_INPUT }, { ...USER, isSuperAdmin: true });
    const { res, status } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(status).toHaveBeenCalledWith(403);
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it("allows enrollment even when the user already has a TOTP factor (no exclusivity)", async () => {
    mockGetUser.mockResolvedValue({
      multiFactor: { enrolledFactors: [{ factorId: "totp" }] },
    });
    const req = makeReq({ phone: PHONE_INPUT }, USER);
    const { res, status, json } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(status).not.toHaveBeenCalledWith(409);
    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
    // The challenge is written, confirming the flow proceeded normally.
    expect(docStore.get("mfaOtpChallenges/user-1")?.purpose).toBe("enroll");
  });

  it("sends the template, writes the challenge, and returns a masked phone", async () => {
    const req = makeReq({ phone: PHONE_INPUT }, USER);
    const { res, json } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
    const [to, templateName, lang] = mockSendTemplate.mock.calls[0];
    expect(to).toBe("5511999998888");
    expect(templateName).toBe("otp_template");
    expect(lang).toBe("pt_BR");

    // Challenge doc persisted under mfaOtpChallenges/{uid} with purpose enroll.
    const challenge = docStore.get("mfaOtpChallenges/user-1");
    expect(challenge?.purpose).toBe("enroll");
    expect(challenge?.phoneHash).toBeDefined();
    expect(challenge?.codeHash).toBeDefined();
    // The raw phone is NOT in the challenge doc.
    expect(JSON.stringify(challenge)).not.toContain("5511999998888");

    // Pending plaintext phone stashed on the user doc for the verify step.
    const userDoc = docStore.get("users/user-1");
    expect(userDoc?.whatsappMfaPendingPhone).toBe("5511999998888");

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        maskedPhone: expect.stringContaining("8888"),
        retryAfterSeconds: 60,
      }),
    );
  });

  it("returns 429 with retryAfterSeconds when a recent challenge is within cooldown", async () => {
    const now = Date.now();
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "enroll",
      phoneHash: "x",
      codeHash: hashOtp("123456"),
      expiresAt: { toMillis: () => now + 250_000 },
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: { toMillis: () => now - 5_000 },
      sendCount: 1,
      sendWindowStart: { toMillis: () => now - 5_000 },
    });

    const req = makeReq({ phone: PHONE_INPUT }, USER);
    const { res, status, json, set } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(status).toHaveBeenCalledWith(429);
    expect(set).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "cooldown",
        retryAfterSeconds: expect.any(Number),
      }),
    );
    const body = json.mock.calls[0][0] as { retryAfterSeconds: number };
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("verifyWhatsappEnroll", () => {
  it("enables the flag, sets the phone, and NEVER writes phoneNumberIndex", async () => {
    const code = "123456";
    const normalizedPhone = "5511999998888";
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "enroll",
      phoneHash: require("crypto").createHash("sha256").update(normalizedPhone).digest("hex"),
      codeHash: hashOtp(code),
      expiresAt: { toMillis: () => Date.now() + 60_000 },
      attempts: 0,
      maxAttempts: 3,
    });
    docStore.set("users/user-1", { whatsappMfaPendingPhone: normalizedPhone });

    const req = makeReq({ code }, USER);
    const { res, json } = makeRes();

    await verifyWhatsappEnroll(req, res);

    expect(json).toHaveBeenCalledWith({ success: true });

    const userDoc = docStore.get("users/user-1");
    expect(userDoc?.whatsappMfaEnabled).toBe(true);
    expect(userDoc?.whatsappMfaPhone).toBe(normalizedPhone);

    // The challenge was consumed.
    expect(docStore.get("mfaOtpChallenges/user-1")).toBeUndefined();

    // CRITICAL: phoneNumberIndex must never be touched.
    const phoneIndexWrites = mockSet.mock.calls.filter(
      (call) => call[0] === "phoneNumberIndex",
    );
    expect(phoneIndexWrites).toHaveLength(0);
    expect(mockCollection).not.toHaveBeenCalledWith("phoneNumberIndex");
  });

  it("returns 400 with attemptsLeft for a wrong code", async () => {
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "enroll",
      phoneHash: "x",
      codeHash: hashOtp("123456"),
      expiresAt: { toMillis: () => Date.now() + 60_000 },
      attempts: 0,
      maxAttempts: 3,
    });

    const req = makeReq({ code: "000000" }, USER);
    const { res, status, json } = makeRes();

    await verifyWhatsappEnroll(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "mismatch", attemptsLeft: 2 }),
    );
  });
});

describe("WhatsApp MFA phone uniqueness (one number = one account)", () => {
  const NORMALIZED = "5511999998888"; // PHONE_INPUT normalized

  it("startWhatsappEnroll rejects 409 when another account already uses the number (master + member)", async () => {
    // The master account already enrolled this WhatsApp number.
    docStore.set("users/master-uid", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: NORMALIZED,
    });

    // The member tries to enroll the SAME number.
    const req = makeReq({ phone: PHONE_INPUT }, USER);
    const { res, status, json } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "phone_in_use" }),
    );
    // No OTP is spent and no challenge is written for the member.
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(docStore.get("mfaOtpChallenges/user-1")).toBeUndefined();
  });

  it("startWhatsappEnroll allows re-enrolling the SAME number on your OWN account", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: NORMALIZED,
    });

    const req = makeReq({ phone: PHONE_INPUT }, USER);
    const { res, status } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(status).not.toHaveBeenCalledWith(409);
    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
  });

  it("startWhatsappEnroll allows the number when only a DIFFERENT number is taken elsewhere", async () => {
    docStore.set("users/other-uid", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511777776666",
    });

    const req = makeReq({ phone: PHONE_INPUT }, USER);
    const { res, status } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(status).not.toHaveBeenCalledWith(409);
    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
  });

  it("startWhatsappEnroll does NOT block on another account's PENDING (unconfirmed) number", async () => {
    // Pending is not proven possession, so it must not reserve the number.
    docStore.set("users/other-uid", { whatsappMfaPendingPhone: NORMALIZED });

    const req = makeReq({ phone: PHONE_INPUT }, USER);
    const { res, status } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(status).not.toHaveBeenCalledWith(409);
    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
  });

  it("verifyWhatsappEnroll rejects 409 when another account claimed the number during the OTP window (race)", async () => {
    const code = "123456";
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "enroll",
      phoneHash: require("crypto")
        .createHash("sha256")
        .update(NORMALIZED)
        .digest("hex"),
      codeHash: hashOtp(code),
      expiresAt: { toMillis: () => Date.now() + 60_000 },
      attempts: 0,
      maxAttempts: 3,
    });
    docStore.set("users/user-1", { whatsappMfaPendingPhone: NORMALIZED });
    // A different account committed the same number after the member's start.
    docStore.set("users/master-uid", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: NORMALIZED,
    });

    const req = makeReq({ code }, USER);
    const { res, status, json } = makeRes();

    await verifyWhatsappEnroll(req, res);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "phone_in_use" }),
    );
    // The member's MFA is NOT enabled and the challenge is NOT consumed.
    expect(docStore.get("users/user-1")?.whatsappMfaEnabled).toBeUndefined();
    expect(docStore.get("users/user-1")?.whatsappMfaPhone).toBeUndefined();
    expect(docStore.get("mfaOtpChallenges/user-1")).toBeDefined();
  });
});

describe("challengeWhatsappLogin", () => {
  it("challenges normally even when a TOTP factor is present (no auto-reconcile / flag untouched)", async () => {
    mockGetUser.mockResolvedValue({
      multiFactor: { enrolledFactors: [{ factorId: "totp" }] },
    });
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });

    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await challengeWhatsappLogin(req, res);

    // The WhatsApp gate is still issued and the flag is NOT cleared.
    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
    expect(docStore.get("users/user-1")?.whatsappMfaEnabled).toBe(true);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        mfaRequired: true,
        method: "whatsapp",
        otpSent: true,
      }),
    );
  });

  it("returns mfaRequired:false when WhatsApp MFA is not enabled", async () => {
    docStore.set("users/user-1", { whatsappMfaEnabled: false });
    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await challengeWhatsappLogin(req, res);

    expect(json).toHaveBeenCalledWith({ mfaRequired: false });
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it("auto-challenge with no prior challenge: sends an OTP, writes the challenge, returns the gate", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });

    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await challengeWhatsappLogin(req, res);

    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
    const challenge = docStore.get("mfaOtpChallenges/user-1");
    expect(challenge?.purpose).toBe("login");

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        mfaRequired: true,
        method: "whatsapp",
        maskedPhone: expect.stringContaining("8888"),
        otpSent: true,
        retryAfterSeconds: 60,
      }),
    );
  });

  it("two concurrent auto-challenges deliver only ONE code (atomic reservation)", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });

    // No prior challenge: WITHOUT the transaction both requests read an empty
    // challenge doc, both pass canSendOtp, and both deliver a code — the user
    // gets two WhatsApp codes. The transactional reserve must let exactly ONE
    // request send; the loser sees the just-committed code and reuses it.
    const ra = makeRes();
    const rb = makeRes();
    await Promise.all([
      challengeWhatsappLogin(makeReq({}, USER), ra.res),
      challengeWhatsappLogin(makeReq({}, USER), rb.res),
    ]);

    expect(mockSendTemplate).toHaveBeenCalledTimes(1);

    // Both responses still gate the login (cookie withheld until the OTP).
    const bodies = [
      ra.json.mock.calls[0][0],
      rb.json.mock.calls[0][0],
    ] as Array<{ mfaRequired: boolean; otpSent: boolean }>;
    expect(bodies.every((b) => b.mfaRequired === true)).toBe(true);
    // Exactly one of the two actually delivered a fresh code.
    expect(bodies.filter((b) => b.otpSent === true)).toHaveLength(1);

    // A single login challenge doc exists for the user.
    expect(docStore.get("mfaOtpChallenges/user-1")?.purpose).toBe("login");
  });

  it("is idempotent: returns the gate WITHOUT resending when a valid challenge is within cooldown", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });

    // A login challenge already exists, sent moments ago (within the 60s
    // cooldown) and still valid (expiresAt in the future). canSendOtp will
    // reject the send; the controller must reuse the pending code, not 429.
    const now = Date.now();
    const existingCodeHash = hashOtp("999999");
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "login",
      phoneHash: require("crypto")
        .createHash("sha256")
        .update("5511999998888")
        .digest("hex"),
      codeHash: existingCodeHash,
      expiresAt: { toMillis: () => now + 250_000 },
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: { toMillis: () => now - 5_000 },
      sendCount: 1,
      sendWindowStart: { toMillis: () => now - 5_000 },
    });

    const req = makeReq({}, USER);
    const { res, json, status } = makeRes();

    await challengeWhatsappLogin(req, res);

    // No new OTP delivered and no 429.
    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith(429);

    // The pending challenge is reused untouched: no new write/code.
    expect(mockSet).not.toHaveBeenCalledWith(
      "mfaOtpChallenges",
      "user-1",
      expect.anything(),
      expect.anything(),
    );
    expect(docStore.get("mfaOtpChallenges/user-1")?.codeHash).toBe(existingCodeHash);

    // The gate is still returned so the login flow can prompt for the code.
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        mfaRequired: true,
        method: "whatsapp",
        maskedPhone: expect.stringContaining("8888"),
        otpSent: false,
      }),
    );

    // retryAfterSeconds reflects the remaining cooldown (a positive number).
    const body = json.mock.calls[0][0] as { retryAfterSeconds: number };
    expect(typeof body.retryAfterSeconds).toBe("number");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("auto-challenge reuses a valid code even when the cooldown has ALREADY elapsed (core of the fix)", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });

    // Valid login code (expiresAt in the future), but the cooldown has already
    // passed (lastSentAt ~90s ago). canSendOtp would allow a new send — yet on
    // an auto-challenge we must STILL reuse the pending code, not burn a send.
    const now = Date.now();
    const existingCodeHash = hashOtp("888888");
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "login",
      phoneHash: require("crypto")
        .createHash("sha256")
        .update("5511999998888")
        .digest("hex"),
      codeHash: existingCodeHash,
      expiresAt: { toMillis: () => now + 200_000 },
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: { toMillis: () => now - 90_000 },
      sendCount: 1,
      sendWindowStart: { toMillis: () => now - 90_000 },
    });

    const req = makeReq({}, USER);
    const { res, json, status } = makeRes();

    await challengeWhatsappLogin(req, res);

    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalledWith(429);
    expect(docStore.get("mfaOtpChallenges/user-1")?.codeHash).toBe(existingCodeHash);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        mfaRequired: true,
        method: "whatsapp",
        otpSent: false,
        // Cooldown already elapsed → resend is unlocked → 0.
        retryAfterSeconds: 0,
      }),
    );
  });

  it("resend:true sends a fresh code when the cooldown has passed", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });

    const now = Date.now();
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "login",
      phoneHash: require("crypto")
        .createHash("sha256")
        .update("5511999998888")
        .digest("hex"),
      codeHash: hashOtp("111111"),
      expiresAt: { toMillis: () => now + 200_000 },
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: { toMillis: () => now - 90_000 },
      sendCount: 1,
      sendWindowStart: { toMillis: () => now - 90_000 },
    });

    const req = makeReq({ resend: true }, USER);
    const { res, json } = makeRes();

    await challengeWhatsappLogin(req, res);

    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        mfaRequired: true,
        method: "whatsapp",
        otpSent: true,
        retryAfterSeconds: 60,
      }),
    );
  });

  it("resend:true does NOT send when still within the cooldown", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });

    const now = Date.now();
    const existingCodeHash = hashOtp("222222");
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "login",
      phoneHash: require("crypto")
        .createHash("sha256")
        .update("5511999998888")
        .digest("hex"),
      codeHash: existingCodeHash,
      expiresAt: { toMillis: () => now + 250_000 },
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: { toMillis: () => now - 5_000 },
      sendCount: 1,
      sendWindowStart: { toMillis: () => now - 5_000 },
    });

    const req = makeReq({ resend: true }, USER);
    const { res, json } = makeRes();

    await challengeWhatsappLogin(req, res);

    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(docStore.get("mfaOtpChallenges/user-1")?.codeHash).toBe(existingCodeHash);

    const body = json.mock.calls[0][0] as {
      otpSent: boolean;
      retryAfterSeconds: number;
    };
    expect(body.otpSent).toBe(false);
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resend:true does NOT send when the hourly cap is reached and reports the window remaining", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });

    // Cooldown elapsed but hourly cap (5) reached within the open window.
    const now = Date.now();
    const existingCodeHash = hashOtp("333333");
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "login",
      phoneHash: require("crypto")
        .createHash("sha256")
        .update("5511999998888")
        .digest("hex"),
      codeHash: existingCodeHash,
      expiresAt: { toMillis: () => now + 100_000 },
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: { toMillis: () => now - 90_000 },
      sendCount: 5,
      sendWindowStart: { toMillis: () => now - 10 * 60_000 },
    });

    const req = makeReq({ resend: true }, USER);
    const { res, json } = makeRes();

    await challengeWhatsappLogin(req, res);

    expect(mockSendTemplate).not.toHaveBeenCalled();
    expect(docStore.get("mfaOtpChallenges/user-1")?.codeHash).toBe(existingCodeHash);

    const body = json.mock.calls[0][0] as {
      otpSent: boolean;
      retryAfterSeconds: number;
    };
    expect(body.otpSent).toBe(false);
    // ~50 minutes left in the hourly window.
    expect(body.retryAfterSeconds).toBeGreaterThan(60);
  });
});

describe("verifyWhatsappLogin", () => {
  it("returns verified:true for the correct code and consumes the challenge", async () => {
    const code = "654321";
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "login",
      phoneHash: "x",
      codeHash: hashOtp(code),
      expiresAt: { toMillis: () => Date.now() + 60_000 },
      attempts: 0,
      maxAttempts: 3,
    });

    const req = makeReq({ code }, USER);
    const { res, json } = makeRes();

    await verifyWhatsappLogin(req, res);

    expect(json).toHaveBeenCalledWith({ verified: true });
    expect(docStore.get("mfaOtpChallenges/user-1")).toBeUndefined();
  });

  it("returns 400 for a wrong code", async () => {
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      tenantId: "tenant-1",
      purpose: "login",
      phoneHash: "x",
      codeHash: hashOtp("654321"),
      expiresAt: { toMillis: () => Date.now() + 60_000 },
      attempts: 0,
      maxAttempts: 3,
    });

    const req = makeReq({ code: "111111" }, USER);
    const { res, status } = makeRes();

    await verifyWhatsappLogin(req, res);

    expect(status).toHaveBeenCalledWith(400);
    // Challenge NOT consumed on a failed attempt.
    expect(docStore.get("mfaOtpChallenges/user-1")).toBeDefined();
  });
});

describe("disableWhatsappMfa", () => {
  it("deletes the recovery codes when the user has NO native TOTP factor", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [{ hash: "h1", usedAt: null }],
      generatedAt: { toDate: () => new Date() },
    });
    // No TOTP factor enrolled — disabling WhatsApp leaves ZERO 2FA methods.
    mockGetUser.mockResolvedValue({ multiFactor: { enrolledFactors: [] } });

    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await disableWhatsappMfa(req, res);

    expect(json).toHaveBeenCalledWith({ success: true });
    expect(docStore.get("users/user-1")?.whatsappMfaEnabled).toBe(false);
    // Codes are purged because no method remains.
    expect(docStore.get("mfaRecoveryCodes/user-1")).toBeUndefined();
  });

  it("KEEPS the recovery codes when the user still has a native TOTP factor", async () => {
    docStore.set("users/user-1", {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999998888",
    });
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [{ hash: "h1", usedAt: null }],
      generatedAt: { toDate: () => new Date() },
    });
    // A TOTP factor remains active after WhatsApp is disabled.
    mockGetUser.mockResolvedValue({
      multiFactor: { enrolledFactors: [{ factorId: "totp" }] },
    });

    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await disableWhatsappMfa(req, res);

    expect(json).toHaveBeenCalledWith({ success: true });
    expect(docStore.get("users/user-1")?.whatsappMfaEnabled).toBe(false);
    // Codes are preserved because TOTP is still an active 2FA method.
    expect(docStore.get("mfaRecoveryCodes/user-1")).toBeDefined();
  });
});
