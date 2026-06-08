/**
 * Unit tests for mfa-recovery.controller.ts (self-service 2FA recovery).
 * Covers anti-enumeration, token lifecycle (expired/used), password
 * re-authentication via the Identity Platform REST endpoint, and the
 * Google-only (link-only) path.
 */

const mockGetUserByEmail = jest.fn();
const mockGetUser = jest.fn();

const mockDocGet = jest.fn();
const mockDocSet = jest.fn();
const mockDocUpdate = jest.fn();
const mockDoc = jest.fn(() => ({
  get: mockDocGet,
  set: mockDocSet,
  update: mockDocUpdate,
}));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock("../../../init", () => ({
  auth: {
    getUserByEmail: mockGetUserByEmail,
    getUser: mockGetUser,
  },
  db: { collection: mockCollection },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock("../../../lib/request-origin", () => ({
  resolveTrustedRequestOrigin: jest.fn(() => "https://app.proops.com.br"),
}));

jest.mock("../../../services/email/send-email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("../../../lib/mfa-reset", () => ({
  clearUserMfaFactors: jest.fn(),
}));

jest.mock("../../../lib/security-observability", () => ({
  writeSecurityAuditEvent: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => {
  class FakeTimestamp {
    constructor(public ms: number) {}
    toMillis() {
      return this.ms;
    }
    static fromMillis(ms: number) {
      return new FakeTimestamp(ms);
    }
    static now() {
      return new FakeTimestamp(Date.now());
    }
  }
  return { Timestamp: FakeTimestamp };
});

import type { Request, Response } from "express";
import { sendEmail } from "../../../services/email/send-email";
import { clearUserMfaFactors } from "../../../lib/mfa-reset";
import { generateRecoveryToken } from "../../../lib/mfa-recovery-token";
import {
  confirmMfaRecovery,
  inspectMfaRecoveryToken,
  requestMfaRecovery,
} from "../mfa-recovery.controller";

const mockSendEmail = sendEmail as jest.Mock;
const mockClearFactors = clearUserMfaFactors as jest.Mock;

function makeReq(body: unknown): Request {
  return { body, headers: {}, path: "/forgot-mfa" } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
    NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
  };
  delete process.env.MFA_RECOVERY_TTL_SECONDS;
  mockSendEmail.mockResolvedValue({ ok: true, messageId: "msg_1" });
  mockClearFactors.mockResolvedValue(undefined);
  mockDocSet.mockResolvedValue(undefined);
  mockDocUpdate.mockResolvedValue(undefined);
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("requestMfaRecovery", () => {
  it("returns success without sending when the email is unknown", async () => {
    mockGetUserByEmail.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );
    const { res, status, json } = makeRes();

    await requestMfaRecovery(makeReq({ email: "ghost@example.com" }), res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(mockDocSet).not.toHaveBeenCalled();
  });

  it("returns success without sending when the email is unverified", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "uid-1",
      emailVerified: false,
      providerData: [{ providerId: "password" }],
    });
    const { res, status, json } = makeRes();

    await requestMfaRecovery(makeReq({ email: "user@example.com" }), res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("persists the token doc and sends the recovery email for an eligible account", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "uid-1",
      emailVerified: true,
      providerData: [{ providerId: "password" }],
    });
    const { res, status, json } = makeRes();

    await requestMfaRecovery(makeReq({ email: "user@example.com" }), res);

    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockDocSet).toHaveBeenCalledTimes(1);
    const tokenDoc = mockDocSet.mock.calls[0][0];
    expect(tokenDoc.uid).toBe("uid-1");
    expect(tokenDoc.hasPasswordProvider).toBe(true);
    expect(tokenDoc.used).toBe(false);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mockSendEmail.mock.calls[0][0];
    expect(emailArgs.to).toBe("user@example.com");
    expect(emailArgs.type).toBe("mfa_recovery");
    expect(emailArgs.html).toContain(
      "https://app.proops.com.br/recover-mfa?token=",
    );
  });

  it("records hasPasswordProvider=false for a Google-only account", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "uid-g",
      emailVerified: true,
      providerData: [{ providerId: "google.com" }],
    });
    const { res } = makeRes();

    await requestMfaRecovery(makeReq({ email: "g@example.com" }), res);

    expect(mockDocSet.mock.calls[0][0].hasPasswordProvider).toBe(false);
  });

  it("returns success on malformed body without touching the DB", async () => {
    const { res, status, json } = makeRes();
    await requestMfaRecovery(makeReq({ email: "not-an-email" }), res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockGetUserByEmail).not.toHaveBeenCalled();
  });
});

describe("inspectMfaRecoveryToken", () => {
  function validTokenDoc(uid: string, overrides = {}) {
    return {
      uid,
      hasPasswordProvider: true,
      expiresAt: { toMillis: () => Date.now() + 60_000 },
      used: false,
      ...overrides,
    };
  }

  it("returns valid:false for a malformed token", async () => {
    const { res, json } = makeRes();
    await inspectMfaRecoveryToken(makeReq({ token: "garbage" }), res);
    expect(json).toHaveBeenCalledWith({ valid: false });
  });

  it("returns valid:true with hasPassword for a fresh unused token", async () => {
    const token = generateRecoveryToken("uid-1");
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => validTokenDoc("uid-1"),
    });
    const { res, json } = makeRes();

    await inspectMfaRecoveryToken(makeReq({ token }), res);

    expect(json).toHaveBeenCalledWith({ valid: true, hasPassword: true });
  });

  it("returns valid:false when the token is already used", async () => {
    const token = generateRecoveryToken("uid-1");
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => validTokenDoc("uid-1", { used: true }),
    });
    const { res, json } = makeRes();

    await inspectMfaRecoveryToken(makeReq({ token }), res);

    expect(json).toHaveBeenCalledWith({ valid: false });
  });
});

describe("confirmMfaRecovery", () => {
  function freshDoc(uid: string, overrides = {}) {
    return {
      exists: true,
      data: () => ({
        uid,
        hasPasswordProvider: true,
        expiresAt: { toMillis: () => Date.now() + 60_000 },
        used: false,
        ...overrides,
      }),
    };
  }

  it("returns 400 for a malformed token", async () => {
    const { res, status, json } = makeRes();
    await confirmMfaRecovery(makeReq({ token: "garbage" }), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      message: "Token inválido ou expirado.",
    });
    expect(mockClearFactors).not.toHaveBeenCalled();
  });

  it("returns 400 when the token doc is already used", async () => {
    const token = generateRecoveryToken("uid-1");
    mockDocGet.mockResolvedValue(freshDoc("uid-1", { used: true }));
    const { res, status } = makeRes();

    await confirmMfaRecovery(makeReq({ token, password: "pw" }), res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockClearFactors).not.toHaveBeenCalled();
  });

  it("returns 400 when the token doc is expired", async () => {
    const token = generateRecoveryToken("uid-1");
    mockDocGet.mockResolvedValue(
      freshDoc("uid-1", { expiresAt: { toMillis: () => Date.now() - 1000 } }),
    );
    const { res, status } = makeRes();

    await confirmMfaRecovery(makeReq({ token, password: "pw" }), res);

    expect(status).toHaveBeenCalledWith(400);
    expect(mockClearFactors).not.toHaveBeenCalled();
  });

  it("password account: wrong password (REST 400) returns 400 and does not clear factors", async () => {
    const token = generateRecoveryToken("uid-1");
    mockDocGet.mockResolvedValue(freshDoc("uid-1"));
    mockGetUser.mockResolvedValue({
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
    });
    global.fetch = jest.fn().mockResolvedValue({ status: 400 }) as jest.Mock;
    const { res, status, json } = makeRes();

    await confirmMfaRecovery(makeReq({ token, password: "wrong" }), res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "Senha incorreta." });
    expect(mockClearFactors).not.toHaveBeenCalled();
  });

  it("password account: missing password returns 400", async () => {
    const token = generateRecoveryToken("uid-1");
    mockDocGet.mockResolvedValue(freshDoc("uid-1"));
    mockGetUser.mockResolvedValue({
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
    });
    const { res, status, json } = makeRes();

    await confirmMfaRecovery(makeReq({ token }), res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "Senha incorreta." });
    expect(mockClearFactors).not.toHaveBeenCalled();
  });

  it("password account: correct password (REST 200) clears factors and marks token used", async () => {
    const token = generateRecoveryToken("uid-1");
    mockDocGet.mockResolvedValue(freshDoc("uid-1"));
    mockGetUser.mockResolvedValue({
      email: "user@example.com",
      providerData: [{ providerId: "password" }],
    });
    global.fetch = jest.fn().mockResolvedValue({ status: 200 }) as jest.Mock;
    const { res, status, json } = makeRes();

    await confirmMfaRecovery(makeReq({ token, password: "right" }), res);

    expect(mockClearFactors).toHaveBeenCalledWith("uid-1");
    expect(mockDocUpdate).toHaveBeenCalledWith({ used: true });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it("Google-only account: valid token clears factors without requiring a password", async () => {
    const token = generateRecoveryToken("uid-g");
    mockDocGet.mockResolvedValue(
      freshDoc("uid-g", { hasPasswordProvider: false }),
    );
    mockGetUser.mockResolvedValue({
      email: "g@example.com",
      providerData: [{ providerId: "google.com" }],
    });
    global.fetch = jest.fn() as jest.Mock;
    const { res, status, json } = makeRes();

    await confirmMfaRecovery(makeReq({ token }), res);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockClearFactors).toHaveBeenCalledWith("uid-g");
    expect(mockDocUpdate).toHaveBeenCalledWith({ used: true });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it("Google-only account: ignores a supplied password", async () => {
    const token = generateRecoveryToken("uid-g");
    mockDocGet.mockResolvedValue(
      freshDoc("uid-g", { hasPasswordProvider: false }),
    );
    mockGetUser.mockResolvedValue({
      email: "g@example.com",
      providerData: [{ providerId: "google.com" }],
    });
    global.fetch = jest.fn() as jest.Mock;
    const { res, status } = makeRes();

    await confirmMfaRecovery(makeReq({ token, password: "ignored" }), res);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockClearFactors).toHaveBeenCalledWith("uid-g");
    expect(status).toHaveBeenCalledWith(200);
  });
});
