/**
 * Unit tests for recovery-codes.controller.ts.
 *
 * Mocks Firestore (db with a simple in-memory doc store + runTransaction),
 * the logger and the security audit writer. Asserts: generate stores hashes and
 * returns plaintext codes once; status counts remaining correctly; verify
 * consumes a valid code (marks usedAt, decrements remaining) and rejects an
 * invalid or already-used code.
 */

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

const mockRunTransaction = jest.fn(
  async (
    fn: (tx: {
      get: (ref: { get: () => unknown }) => unknown;
      update: (ref: { __key: string }, value: Record<string, unknown>) => void;
    }) => unknown,
  ) => {
    const tx = {
      get: (ref: { get: () => unknown }) => ref.get(),
      update: (ref: { __key: string }, value: Record<string, unknown>) => {
        const existing = docStore.get(ref.__key) ?? {};
        docStore.set(ref.__key, { ...existing, ...value });
      },
    };
    return fn(tx);
  },
);

const mockGetUserByEmail = jest.fn();
const mockCreateCustomToken = jest.fn();
const mockGetUser = jest.fn();
jest.mock("../../../init", () => ({
  auth: {
    getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
    createCustomToken: (...args: unknown[]) => mockCreateCustomToken(...args),
    getUser: (...args: unknown[]) => mockGetUser(...args),
  },
  db: {
    collection: (name: string) => mockCollection(name),
    runTransaction: (fn: unknown) => mockRunTransaction(fn as never),
  },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockSendEmail = jest.fn();
jest.mock("../../../services/email/send-email", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockWriteAudit = jest.fn();
jest.mock("../../../lib/security-observability", () => ({
  writeSecurityAuditEvent: (...args: unknown[]) => mockWriteAudit(...args),
}));

let nowCounter = 1_700_000_000_000;
jest.mock("firebase-admin/firestore", () => {
  const actual = jest.requireActual("firebase-admin/firestore");
  return {
    ...actual,
    Timestamp: {
      now: () => {
        const ms = (nowCounter += 1000);
        return { toDate: () => new Date(ms), __ts: ms };
      },
    },
  };
});

import type { Request, Response } from "express";
import {
  generateRecoveryCodesHandler,
  getRecoveryCodesStatusHandler,
  reconcileRecoveryCodes,
  reconcileRecoveryCodesHandler,
  recoverTotpWithCode,
  verifyRecoveryCodeHandler,
} from "../recovery-codes.controller";
import { hashRecoveryCode } from "../../../lib/mfa-recovery-codes";

function makeReq(
  body: unknown,
  user: { uid: string; tenantId: string },
): Request {
  return {
    body,
    user,
    path: "/v1/auth/recovery-codes/test",
    headers: {},
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

const USER = { uid: "user-1", tenantId: "tenant-1" };

beforeEach(() => {
  jest.clearAllMocks();
  docStore.clear();
});

describe("generateRecoveryCodesHandler", () => {
  it("stores hashes and returns 10 plaintext codes once", async () => {
    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await generateRecoveryCodesHandler(req, res);

    const body = json.mock.calls[0][0] as { codes: string[] };
    expect(body.codes).toHaveLength(10);

    const stored = docStore.get("mfaRecoveryCodes/user-1") as {
      uid: string;
      codes: { hash: string; usedAt: unknown }[];
    };
    expect(stored.uid).toBe("user-1");
    expect(stored.codes).toHaveLength(10);
    // All stored as hashes (not plaintext) and unused.
    for (let i = 0; i < 10; i += 1) {
      expect(stored.codes[i].hash).toBe(hashRecoveryCode(body.codes[i]));
      expect(stored.codes[i].usedAt).toBeNull();
    }
    // Plaintext is never persisted.
    expect(JSON.stringify(stored)).not.toContain(body.codes[0]);

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "recovery_codes_generated", uid: "user-1" }),
    );
  });

  it("replaces previous codes on regeneration", async () => {
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [{ hash: hashRecoveryCode("old1-old1"), usedAt: null }],
      generatedAt: { toDate: () => new Date() },
    });

    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await generateRecoveryCodesHandler(req, res);

    const body = json.mock.calls[0][0] as { codes: string[] };
    const stored = docStore.get("mfaRecoveryCodes/user-1") as {
      codes: { hash: string }[];
    };
    expect(stored.codes).toHaveLength(10);
    // Old code is gone.
    expect(verifyOldCodeStillPresent(stored.codes)).toBe(false);
    expect(body.codes).toHaveLength(10);
  });
});

function verifyOldCodeStillPresent(codes: { hash: string }[]): boolean {
  return codes.some((c) => c.hash === hashRecoveryCode("old1-old1"));
}

describe("getRecoveryCodesStatusHandler", () => {
  it("returns zeros when no codes exist", async () => {
    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await getRecoveryCodesStatusHandler(req, res);

    expect(json).toHaveBeenCalledWith({ total: 0, remaining: 0 });
  });

  it("counts remaining (unused) codes correctly and does not leak codes", async () => {
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [
        { hash: hashRecoveryCode("aaaa-bbbb"), usedAt: null },
        { hash: hashRecoveryCode("cccc-dddd"), usedAt: { toDate: () => new Date() } },
        { hash: hashRecoveryCode("eeee-ffff"), usedAt: null },
      ],
      generatedAt: { toDate: () => new Date("2026-01-01T00:00:00Z") },
    });

    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await getRecoveryCodesStatusHandler(req, res);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.total).toBe(3);
    expect(body.remaining).toBe(2);
    expect(body.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    // The hashes/codes are never returned.
    expect(JSON.stringify(body)).not.toContain("hash");
  });
});

describe("verifyRecoveryCodeHandler", () => {
  it("consumes a valid code: marks usedAt and decrements remaining", async () => {
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [
        { hash: hashRecoveryCode("aaaa-bbbb"), usedAt: null },
        { hash: hashRecoveryCode("cccc-dddd"), usedAt: null },
      ],
      generatedAt: { toDate: () => new Date() },
    });

    const req = makeReq({ code: "cccc-dddd" }, USER);
    const { res, json } = makeRes();

    await verifyRecoveryCodeHandler(req, res);

    expect(json).toHaveBeenCalledWith({ verified: true, remaining: 1 });

    const stored = docStore.get("mfaRecoveryCodes/user-1") as {
      codes: { hash: string; usedAt: unknown }[];
    };
    // The matched code is now marked used; the other remains unused.
    expect(stored.codes[0].usedAt).toBeNull();
    expect(stored.codes[1].usedAt).not.toBeNull();

    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "recovery_code_used", uid: "user-1" }),
    );
  });

  it("rejects an invalid code with 400", async () => {
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [{ hash: hashRecoveryCode("aaaa-bbbb"), usedAt: null }],
      generatedAt: { toDate: () => new Date() },
    });

    const req = makeReq({ code: "zzzz-zzzz" }, USER);
    const { res, status, json } = makeRes();

    await verifyRecoveryCodeHandler(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ verified: false }),
    );
    expect(mockWriteAudit).not.toHaveBeenCalled();
    // Code remains unused.
    const stored = docStore.get("mfaRecoveryCodes/user-1") as {
      codes: { usedAt: unknown }[];
    };
    expect(stored.codes[0].usedAt).toBeNull();
  });

  it("rejects an already-used code with 400", async () => {
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [
        { hash: hashRecoveryCode("aaaa-bbbb"), usedAt: { toDate: () => new Date() } },
      ],
      generatedAt: { toDate: () => new Date() },
    });

    const req = makeReq({ code: "aaaa-bbbb" }, USER);
    const { res, status, json } = makeRes();

    await verifyRecoveryCodeHandler(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ verified: false }),
    );
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  it("rejects a missing code body with 400", async () => {
    const req = makeReq({}, USER);
    const { res, status } = makeRes();

    await verifyRecoveryCodeHandler(req, res);

    expect(status).toHaveBeenCalledWith(400);
  });
});

describe("recoverTotpWithCode", () => {
  const GENERIC =
    "Não foi possível concluir a recuperação. Verifique os dados informados.";

  function makePublicReq(body: unknown): Request {
    return {
      body,
      path: "/v1/auth/mfa-recovery/recover-totp",
      headers: {},
    } as unknown as Request;
  }

  function seedCodes(uid: string, plaintext: string[]): void {
    docStore.set(`mfaRecoveryCodes/${uid}`, {
      uid,
      codes: plaintext.map((c) => ({ hash: hashRecoveryCode(c), usedAt: null })),
      generatedAt: { toDate: () => new Date() },
    });
  }

  beforeEach(() => {
    mockGetUserByEmail.mockReset();
    mockCreateCustomToken.mockReset().mockResolvedValue("fake-custom-token");
    mockSendEmail.mockReset().mockResolvedValue({ ok: true });
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it("password account: correct code + password signs in via custom token, consumes code, keeps TOTP factor", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-1",
      email: "alice@example.com",
      providerData: [{ providerId: "password" }],
    });
    seedCodes("user-1", ["aaaa-bbbb", "cccc-dddd"]);
    docStore.set("users/user-1", { tenantId: "tenant-1", name: "Alice" });
    (global.fetch as jest.Mock).mockResolvedValue({ status: 200 });

    const req = makePublicReq({
      email: "alice@example.com",
      code: "cccc-dddd",
      password: "correct-horse",
    });
    const { res, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(json).toHaveBeenCalledWith({
      success: true,
      customToken: "fake-custom-token",
    });
    // TOTP factor is NOT removed; user is signed in via a custom token.
    expect(mockCreateCustomToken).toHaveBeenCalledWith("user-1", {
      recovery_login: true,
    });
    // Code consumed.
    const stored = docStore.get("mfaRecoveryCodes/user-1") as {
      codes: { usedAt: unknown }[];
    };
    expect(stored.codes[0].usedAt).toBeNull();
    expect(stored.codes[1].usedAt).not.toBeNull();
    // Security notification email sent.
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        type: "mfa_recovery_code_used",
      }),
    );
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "mfa_recovery_code_signin",
        uid: "user-1",
        tenantId: "tenant-1",
        reason: "password",
      }),
    );
  });

  it("password account: wrong password returns 400 'Senha incorreta.' and does not sign in", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-1",
      email: "alice@example.com",
      providerData: [{ providerId: "password" }],
    });
    seedCodes("user-1", ["aaaa-bbbb"]);
    (global.fetch as jest.Mock).mockResolvedValue({ status: 400 });

    const req = makePublicReq({
      email: "alice@example.com",
      code: "aaaa-bbbb",
      password: "wrong",
    });
    const { res, status, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "Senha incorreta." });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  it("password account: missing password returns 400 'Senha incorreta.'", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-1",
      email: "alice@example.com",
      providerData: [{ providerId: "password" }],
    });
    seedCodes("user-1", ["aaaa-bbbb"]);

    const req = makePublicReq({ email: "alice@example.com", code: "aaaa-bbbb" });
    const { res, status, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "Senha incorreta." });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("google-only account: code alone signs in via custom token (no password needed)", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-2",
      email: "bob@example.com",
      providerData: [{ providerId: "google.com" }],
    });
    seedCodes("user-2", ["eeee-ffff"]);
    docStore.set("users/user-2", { tenantId: "tenant-2" });

    const req = makePublicReq({ email: "bob@example.com", code: "eeee-ffff" });
    const { res, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(json).toHaveBeenCalledWith({
      success: true,
      customToken: "fake-custom-token",
    });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockCreateCustomToken).toHaveBeenCalledWith("user-2", {
      recovery_login: true,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "mfa_recovery_code_signin",
        reason: "google_code_only",
      }),
    );
  });

  it("createCustomToken failure: returns generic 400 and does NOT consume the code", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-9",
      email: "dave@example.com",
      providerData: [{ providerId: "google.com" }],
    });
    seedCodes("user-9", ["1111-2222"]);
    docStore.set("users/user-9", { tenantId: "tenant-9" });
    // Signing fails — e.g. the runtime service account lacks the
    // "Service Account Token Creator" role, or the local emulator has no key.
    mockCreateCustomToken
      .mockReset()
      .mockRejectedValue(new Error("Failed to determine service account"));

    const req = makePublicReq({ email: "dave@example.com", code: "1111-2222" });
    const { res, status, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: GENERIC });
    // A signing failure must NOT burn a single-use recovery code.
    const stored = docStore.get("mfaRecoveryCodes/user-9") as {
      codes: { usedAt: unknown }[];
    };
    expect(stored.codes[0].usedAt).toBeNull();
    // No login side effects (audit event is only written after a real sign-in).
    expect(mockWriteAudit).not.toHaveBeenCalled();
  });

  it("super admin returns 403 and does not consume code nor sign in", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "super-1",
      email: "root@example.com",
      providerData: [{ providerId: "password" }],
      customClaims: { role: "superadmin" },
    });
    seedCodes("super-1", ["aaaa-bbbb"]);
    docStore.set("users/super-1", { role: "SUPERADMIN" });
    (global.fetch as jest.Mock).mockResolvedValue({ status: 200 });

    const req = makePublicReq({
      email: "root@example.com",
      code: "aaaa-bbbb",
      password: "correct",
    });
    const { res, status, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      message:
        "Contas de super administrador devem usar o reset assistido para recuperar o 2FA.",
    });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
    expect(mockWriteAudit).not.toHaveBeenCalled();
    // Code remains unused.
    const stored = docStore.get("mfaRecoveryCodes/super-1") as {
      codes: { usedAt: unknown }[];
    };
    expect(stored.codes[0].usedAt).toBeNull();
  });

  it("best-effort notification: success even when sendEmail rejects", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-3",
      email: "carol@example.com",
      providerData: [{ providerId: "google.com" }],
    });
    seedCodes("user-3", ["1111-2222"]);
    docStore.set("users/user-3", { tenantId: "tenant-3" });
    mockSendEmail.mockRejectedValue(new Error("resend down"));

    const req = makePublicReq({ email: "carol@example.com", code: "1111-2222" });
    const { res, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(json).toHaveBeenCalledWith({
      success: true,
      customToken: "fake-custom-token",
    });
    expect(mockCreateCustomToken).toHaveBeenCalledWith("user-3", {
      recovery_login: true,
    });
  });

  it("invalid code returns generic 400 and does not sign in", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-1",
      email: "alice@example.com",
      providerData: [{ providerId: "password" }],
    });
    seedCodes("user-1", ["aaaa-bbbb"]);

    const req = makePublicReq({
      email: "alice@example.com",
      code: "zzzz-zzzz",
      password: "whatever",
    });
    const { res, status, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: GENERIC });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("unknown email returns generic 400 (anti-enumeration)", async () => {
    mockGetUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });

    const req = makePublicReq({
      email: "ghost@example.com",
      code: "aaaa-bbbb",
    });
    const { res, status, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: GENERIC });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });

  it("no recovery codes doc returns generic 400", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-9",
      email: "nine@example.com",
      providerData: [{ providerId: "password" }],
    });

    const req = makePublicReq({
      email: "nine@example.com",
      code: "aaaa-bbbb",
      password: "x",
    });
    const { res, status, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: GENERIC });
    expect(mockCreateCustomToken).not.toHaveBeenCalled();
  });
});

describe("reconcileRecoveryCodes", () => {
  function seedCodes(uid: string, count: number): void {
    docStore.set(`mfaRecoveryCodes/${uid}`, {
      uid,
      codes: Array.from({ length: count }, (_, i) => ({
        hash: hashRecoveryCode(`code-${i}-aaaa`),
        usedAt: null,
      })),
      generatedAt: { toDate: () => new Date() },
    });
  }

  it("deletes the codes when there is no TOTP factor and no WhatsApp MFA", async () => {
    seedCodes("user-1", 5);
    mockGetUser.mockResolvedValue({ multiFactor: { enrolledFactors: [] } });
    docStore.set("users/user-1", { whatsappMfaEnabled: false });

    const result = await reconcileRecoveryCodes("user-1");

    expect(result).toEqual({ hasAnyFactor: false, deleted: true });
    expect(docStore.get("mfaRecoveryCodes/user-1")).toBeUndefined();
  });

  it("is idempotent when no codes exist and no factor remains", async () => {
    mockGetUser.mockResolvedValue({ multiFactor: { enrolledFactors: [] } });
    docStore.set("users/user-1", {});

    const result = await reconcileRecoveryCodes("user-1");

    expect(result).toEqual({ hasAnyFactor: false, deleted: true });
    expect(docStore.get("mfaRecoveryCodes/user-1")).toBeUndefined();
  });

  it("keeps the codes when a native TOTP factor is present", async () => {
    seedCodes("user-1", 4);
    mockGetUser.mockResolvedValue({
      multiFactor: { enrolledFactors: [{ factorId: "totp" }] },
    });
    docStore.set("users/user-1", { whatsappMfaEnabled: false });

    const result = await reconcileRecoveryCodes("user-1");

    expect(result).toEqual({ hasAnyFactor: true, deleted: false });
    expect(docStore.get("mfaRecoveryCodes/user-1")).toBeDefined();
  });

  it("keeps the codes when WhatsApp MFA is enabled (no TOTP)", async () => {
    seedCodes("user-1", 3);
    mockGetUser.mockResolvedValue({ multiFactor: { enrolledFactors: [] } });
    docStore.set("users/user-1", { whatsappMfaEnabled: true });

    const result = await reconcileRecoveryCodes("user-1");

    expect(result).toEqual({ hasAnyFactor: true, deleted: false });
    expect(docStore.get("mfaRecoveryCodes/user-1")).toBeDefined();
  });
});

describe("reconcileRecoveryCodesHandler", () => {
  it("returns hasAnyFactor:false and remaining:0 after deleting codes", async () => {
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [{ hash: hashRecoveryCode("aaaa-bbbb"), usedAt: null }],
      generatedAt: { toDate: () => new Date() },
    });
    mockGetUser.mockResolvedValue({ multiFactor: { enrolledFactors: [] } });
    docStore.set("users/user-1", { whatsappMfaEnabled: false });

    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await reconcileRecoveryCodesHandler(req, res);

    expect(json).toHaveBeenCalledWith({ hasAnyFactor: false, remaining: 0 });
    expect(docStore.get("mfaRecoveryCodes/user-1")).toBeUndefined();
  });

  it("returns hasAnyFactor:true and the unused count when a factor remains", async () => {
    docStore.set("mfaRecoveryCodes/user-1", {
      uid: "user-1",
      codes: [
        { hash: hashRecoveryCode("aaaa-bbbb"), usedAt: null },
        { hash: hashRecoveryCode("cccc-dddd"), usedAt: { toDate: () => new Date() } },
        { hash: hashRecoveryCode("eeee-ffff"), usedAt: null },
      ],
      generatedAt: { toDate: () => new Date() },
    });
    mockGetUser.mockResolvedValue({
      multiFactor: { enrolledFactors: [{ factorId: "totp" }] },
    });
    docStore.set("users/user-1", { whatsappMfaEnabled: false });

    const req = makeReq({}, USER);
    const { res, json } = makeRes();

    await reconcileRecoveryCodesHandler(req, res);

    expect(json).toHaveBeenCalledWith({ hasAnyFactor: true, remaining: 2 });
  });
});
