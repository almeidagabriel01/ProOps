/**
 * Unit tests for whatsapp-login-fallback.controller.ts — the public (pre-auth)
 * WhatsApp alternative on the native TOTP screen.
 *
 * Mocks Firestore (in-memory doc store), the Admin auth, the WhatsApp template
 * sender, the logger, the audit writer and `fetch` (password REST check).
 * Asserts: availability gating (password / Google-only / super admin / no
 * WhatsApp), OTP send vs reuse, and verify minting a custom token with the
 * `whatsapp_login` claim while consuming the challenge.
 */

process.env.WHATSAPP_OTP_TEMPLATE_NAME = "test_login_otp";
process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";

const docStore = new Map<string, Record<string, unknown> | undefined>();

function docKey(collection: string, id: string): string {
  return `${collection}/${id}`;
}

function makeDocRef(collection: string, id: string) {
  return {
    __key: docKey(collection, id),
    get: jest.fn(async () => {
      const data = docStore.get(docKey(collection, id));
      return { exists: data !== undefined, data: () => data };
    }),
    set: jest.fn(async (value: Record<string, unknown>) => {
      docStore.set(docKey(collection, id), value);
    }),
    update: jest.fn(async (value: Record<string, unknown>) => {
      const existing = docStore.get(docKey(collection, id)) ?? {};
      docStore.set(docKey(collection, id), { ...existing, ...value });
    }),
    delete: jest.fn(async () => {
      docStore.delete(docKey(collection, id));
    }),
  };
}

const mockCollection = jest.fn((collection: string) => ({
  doc: (id: string) => makeDocRef(collection, id),
}));

// Serializing runTransaction mock — see whatsapp-mfa.controller.test.ts. Models
// Firestore's atomic commit so the second of two concurrent transactions reads
// the first's committed write; tx.get/set are backed by the same doc refs.
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

const mockGetUserByEmail = jest.fn();
const mockCreateCustomToken = jest.fn();
jest.mock("../../../init", () => ({
  auth: {
    getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
    createCustomToken: (...args: unknown[]) => mockCreateCustomToken(...args),
  },
  db: {
    collection: (name: string) => mockCollection(name),
    runTransaction: (fn: (tx: unknown) => Promise<unknown>) =>
      mockRunTransaction(fn),
  },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockWriteAudit = jest.fn();
jest.mock("../../../lib/security-observability", () => ({
  writeSecurityAuditEvent: (...args: unknown[]) => mockWriteAudit(...args),
}));

const mockSendTemplate = jest.fn();
jest.mock("../../services/whatsapp/whatsapp.api", () => ({
  sendWhatsAppTemplate: (...args: unknown[]) => mockSendTemplate(...args),
}));

// recovery-codes.controller (imported for shared helpers) pulls in the email
// sender — mock it so no Resend client is constructed during the test.
jest.mock("../../../services/email/send-email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => {
  const actual = jest.requireActual("firebase-admin/firestore");
  return {
    ...actual,
    Timestamp: {
      fromMillis: (ms: number) => ({ toMillis: () => ms, __ts: ms }),
      now: () => ({ toMillis: () => 1_700_000_000_000 }),
    },
  };
});

import type { Request, Response } from "express";
import {
  checkWhatsappLoginFallback,
  sendWhatsappLoginFallback,
  verifyWhatsappLoginFallback,
} from "../whatsapp-login-fallback.controller";
import { hashOtp } from "../../../lib/mfa-otp";

function makeReq(body: unknown): Request {
  return {
    body,
    path: "/v1/auth/mfa-recovery/whatsapp/test",
    headers: {},
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

const PASSWORD_PROVIDER = [{ providerId: "password" }];
const GOOGLE_PROVIDER = [{ providerId: "google.com" }];

function setUser(
  uid: string,
  providerData: Array<{ providerId: string }>,
  doc: {
    tenantId?: string;
    role?: string;
    whatsappMfaEnabled?: boolean;
    whatsappMfaPhone?: string;
  },
  customClaims?: { role?: string },
) {
  mockGetUserByEmail.mockResolvedValue({ uid, providerData, customClaims });
  docStore.set(`users/${uid}`, doc);
}

const globalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  docStore.clear();
  mockTxChain = Promise.resolve();
  // Default: password REST check succeeds (HTTP 200).
  global.fetch = jest.fn(async () => ({ status: 200 })) as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = globalFetch;
});

describe("checkWhatsappLoginFallback", () => {
  it("returns available + maskedPhone for a password account with correct password and WhatsApp on", async () => {
    setUser("user-1", PASSWORD_PROVIDER, {
      tenantId: "t1",
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999991234",
    });
    const { res, json } = makeRes();
    await checkWhatsappLoginFallback(
      makeReq({ email: "a@b.com", password: "pw" }),
      res,
    );
    const body = json.mock.calls[0][0] as {
      available: boolean;
      maskedPhone?: string;
    };
    expect(body.available).toBe(true);
    expect(body.maskedPhone).toContain("1234");
  });

  it("returns unavailable when the password is wrong (REST 400)", async () => {
    setUser("user-1", PASSWORD_PROVIDER, {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999991234",
    });
    global.fetch = jest.fn(async () => ({ status: 400 })) as unknown as typeof fetch;
    const { res, json } = makeRes();
    await checkWhatsappLoginFallback(
      makeReq({ email: "a@b.com", password: "wrong" }),
      res,
    );
    expect(json.mock.calls[0][0]).toEqual({ available: false });
  });

  it("returns available for a Google-only account without a password", async () => {
    setUser("user-1", GOOGLE_PROVIDER, {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999991234",
    });
    const { res, json } = makeRes();
    await checkWhatsappLoginFallback(makeReq({ email: "a@b.com" }), res);
    expect((json.mock.calls[0][0] as { available: boolean }).available).toBe(
      true,
    );
    // No password verification for Google-only accounts.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns unavailable when WhatsApp MFA is not enabled", async () => {
    setUser("user-1", GOOGLE_PROVIDER, { whatsappMfaEnabled: false });
    const { res, json } = makeRes();
    await checkWhatsappLoginFallback(makeReq({ email: "a@b.com" }), res);
    expect(json.mock.calls[0][0]).toEqual({ available: false });
  });

  it("returns unavailable for a super admin", async () => {
    setUser(
      "user-1",
      GOOGLE_PROVIDER,
      {
        role: "SUPERADMIN",
        whatsappMfaEnabled: true,
        whatsappMfaPhone: "5511999991234",
      },
      { role: "SUPERADMIN" },
    );
    const { res, json } = makeRes();
    await checkWhatsappLoginFallback(makeReq({ email: "a@b.com" }), res);
    expect(json.mock.calls[0][0]).toEqual({ available: false });
  });

  it("returns unavailable for an unknown email (anti-enumeration)", async () => {
    mockGetUserByEmail.mockRejectedValue(new Error("not found"));
    const { res, json } = makeRes();
    await checkWhatsappLoginFallback(makeReq({ email: "nope@b.com" }), res);
    expect(json.mock.calls[0][0]).toEqual({ available: false });
  });
});

describe("sendWhatsappLoginFallback", () => {
  it("sends a fresh OTP and writes the challenge when none exists", async () => {
    setUser("user-1", GOOGLE_PROVIDER, {
      tenantId: "t1",
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999991234",
    });
    const { res, json } = makeRes();
    await sendWhatsappLoginFallback(makeReq({ email: "a@b.com" }), res);

    const body = json.mock.calls[0][0] as {
      available: boolean;
      otpSent: boolean;
    };
    expect(body.available).toBe(true);
    expect(body.otpSent).toBe(true);
    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
    const stored = docStore.get("mfaOtpChallenges/user-1") as
      | { purpose: string }
      | undefined;
    expect(stored?.purpose).toBe("login");
  });

  it("two concurrent fallback requests deliver only ONE code (atomic reservation)", async () => {
    setUser("user-1", GOOGLE_PROVIDER, {
      tenantId: "t1",
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999991234",
    });

    const ra = makeRes();
    const rb = makeRes();
    await Promise.all([
      sendWhatsappLoginFallback(makeReq({ email: "a@b.com" }), ra.res),
      sendWhatsappLoginFallback(makeReq({ email: "a@b.com" }), rb.res),
    ]);

    // Without the transaction both reads see no challenge and both deliver a
    // code; the transactional reserve must let exactly one send.
    expect(mockSendTemplate).toHaveBeenCalledTimes(1);
    const bodies = [
      ra.json.mock.calls[0][0],
      rb.json.mock.calls[0][0],
    ] as Array<{ available: boolean; otpSent: boolean }>;
    expect(bodies.every((b) => b.available === true)).toBe(true);
    expect(bodies.filter((b) => b.otpSent === true)).toHaveLength(1);
  });

  it("reuses a still-valid login code without sending again (cooldown)", async () => {
    setUser("user-1", GOOGLE_PROVIDER, {
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "5511999991234",
    });
    const now = Date.now();
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      purpose: "login",
      codeHash: hashOtp("123456"),
      expiresAt: now + 5 * 60 * 1000,
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: now - 1000, // 1s ago → within cooldown
      sendCount: 1,
      sendWindowStart: now - 1000,
    });
    const { res, json } = makeRes();
    await sendWhatsappLoginFallback(makeReq({ email: "a@b.com" }), res);

    const body = json.mock.calls[0][0] as { otpSent: boolean };
    expect(body.otpSent).toBe(false);
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });

  it("does not send when WhatsApp is unavailable", async () => {
    setUser("user-1", GOOGLE_PROVIDER, { whatsappMfaEnabled: false });
    const { res, json } = makeRes();
    await sendWhatsappLoginFallback(makeReq({ email: "a@b.com" }), res);
    expect(json.mock.calls[0][0]).toEqual({ available: false });
    expect(mockSendTemplate).not.toHaveBeenCalled();
  });
});

describe("verifyWhatsappLoginFallback", () => {
  function seedLoginChallenge(code: string) {
    const now = Date.now();
    docStore.set("mfaOtpChallenges/user-1", {
      uid: "user-1",
      purpose: "login",
      codeHash: hashOtp(code),
      expiresAt: now + 5 * 60 * 1000,
      attempts: 0,
      maxAttempts: 3,
      lastSentAt: now,
      sendCount: 1,
      sendWindowStart: now,
    });
  }

  it("mints a custom token with whatsapp_login and consumes the challenge on a valid code", async () => {
    setUser("user-1", GOOGLE_PROVIDER, { tenantId: "t1" });
    mockCreateCustomToken.mockResolvedValue("CUSTOM_TOKEN");
    seedLoginChallenge("123456");

    const { res, json } = makeRes();
    await verifyWhatsappLoginFallback(
      makeReq({ email: "a@b.com", code: "123456" }),
      res,
    );

    expect(mockCreateCustomToken).toHaveBeenCalledWith("user-1", {
      whatsapp_login: true,
    });
    expect(json.mock.calls[0][0]).toEqual({
      success: true,
      customToken: "CUSTOM_TOKEN",
    });
    // Challenge consumed.
    expect(docStore.get("mfaOtpChallenges/user-1")).toBeUndefined();
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ source: "whatsapp_login_fallback" }),
    );
  });

  it("rejects an invalid code with 400 + attemptsLeft and does not mint a token", async () => {
    setUser("user-1", GOOGLE_PROVIDER, { tenantId: "t1" });
    seedLoginChallenge("123456");

    const { res, json, status } = makeRes();
    await verifyWhatsappLoginFallback(
      makeReq({ email: "a@b.com", code: "000000" }),
      res,
    );

    expect(status).toHaveBeenCalledWith(400);
    const body = json.mock.calls[0][0] as { attemptsLeft?: number };
    expect(body.attemptsLeft).toBe(2);
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
    // Challenge NOT consumed; attempts incremented.
    expect(docStore.get("mfaOtpChallenges/user-1")).toBeDefined();
  });

  it("rejects with 400 when no challenge is pending", async () => {
    setUser("user-1", GOOGLE_PROVIDER, { tenantId: "t1" });
    const { res, status } = makeRes();
    await verifyWhatsappLoginFallback(
      makeReq({ email: "a@b.com", code: "123456" }),
      res,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("rejects a super admin generically without minting a token", async () => {
    setUser(
      "user-1",
      GOOGLE_PROVIDER,
      { tenantId: "t1", role: "SUPERADMIN" },
      { role: "SUPERADMIN" },
    );
    seedLoginChallenge("123456");
    const { res, status } = makeRes();
    await verifyWhatsappLoginFallback(
      makeReq({ email: "a@b.com", code: "123456" }),
      res,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });
});
