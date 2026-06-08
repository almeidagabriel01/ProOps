/**
 * Unit tests for whatsapp-mfa.controller.ts.
 *
 * Mocks Firestore (db), Firebase Auth (getUser), the WhatsApp template sender,
 * the logger and the security audit writer. Asserts: super-admin rejection,
 * TOTP exclusivity, happy-path enroll/verify, that phoneNumberIndex is NEVER
 * written, login auto-reconciliation, and login verification.
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

const mockCollection = jest.fn((collection: string) => ({
  doc: (id: string) => makeDocRef(collection, id),
}));

const mockGetUser = jest.fn();

jest.mock("../../../init", () => ({
  db: { collection: (name: string) => mockCollection(name) },
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

  it("rejects with 409 when the user already has a TOTP factor", async () => {
    mockGetUser.mockResolvedValue({
      multiFactor: { enrolledFactors: [{ factorId: "totp" }] },
    });
    const req = makeReq({ phone: PHONE_INPUT }, USER);
    const { res, status } = makeRes();

    await startWhatsappEnroll(req, res);

    expect(status).toHaveBeenCalledWith(409);
    expect(mockSendTemplate).not.toHaveBeenCalled();
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
      expect.objectContaining({ success: true, maskedPhone: expect.stringContaining("8888") }),
    );
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

describe("challengeWhatsappLogin", () => {
  it("auto-reconciles: clears the flag and returns mfaRequired:false when TOTP is present", async () => {
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

    expect(json).toHaveBeenCalledWith({ mfaRequired: false });
    expect(docStore.get("users/user-1")?.whatsappMfaEnabled).toBe(false);
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it("returns mfaRequired:false when WhatsApp MFA is not enabled", async () => {
    docStore.set("users/user-1", { whatsappMfaEnabled: false });
    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await challengeWhatsappLogin(req, res);

    expect(json).toHaveBeenCalledWith({ mfaRequired: false });
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it("sends an OTP and returns maskedPhone when WhatsApp MFA is enabled", async () => {
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
      }),
    );
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
      }),
    );
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
