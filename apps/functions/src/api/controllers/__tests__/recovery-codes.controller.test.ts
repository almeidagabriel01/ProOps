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
jest.mock("../../../init", () => ({
  auth: { getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args) },
  db: {
    collection: (name: string) => mockCollection(name),
    runTransaction: (fn: unknown) => mockRunTransaction(fn as never),
  },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockClearFactors = jest.fn();
jest.mock("../../../lib/mfa-reset", () => ({
  clearUserMfaFactors: (...args: unknown[]) => mockClearFactors(...args),
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
    mockClearFactors.mockReset().mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it("password account: correct code + password removes native factor, consumes code, keeps whatsapp flags", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "user-1",
      email: "alice@example.com",
      providerData: [{ providerId: "password" }],
    });
    seedCodes("user-1", ["aaaa-bbbb", "cccc-dddd"]);
    // Pre-existing whatsapp flags on the user doc must remain untouched.
    docStore.set("users/user-1", {
      tenantId: "tenant-1",
      whatsappMfaEnabled: true,
      whatsappMfaPhone: "+5511999999999",
    });
    (global.fetch as jest.Mock).mockResolvedValue({ status: 200 });

    const req = makePublicReq({
      email: "alice@example.com",
      code: "cccc-dddd",
      password: "correct-horse",
    });
    const { res, json } = makeRes();

    await recoverTotpWithCode(req, res);

    expect(json).toHaveBeenCalledWith({ success: true });
    expect(mockClearFactors).toHaveBeenCalledWith("user-1", {
      includeWhatsapp: false,
    });
    // Code consumed.
    const stored = docStore.get("mfaRecoveryCodes/user-1") as {
      codes: { usedAt: unknown }[];
    };
    expect(stored.codes[0].usedAt).toBeNull();
    expect(stored.codes[1].usedAt).not.toBeNull();
    // WhatsApp flags untouched by this flow (clearUserMfaFactors is mocked).
    const userDoc = docStore.get("users/user-1") as Record<string, unknown>;
    expect(userDoc.whatsappMfaEnabled).toBe(true);
    expect(userDoc.whatsappMfaPhone).toBe("+5511999999999");
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "mfa_totp_recovery_with_code",
        uid: "user-1",
        tenantId: "tenant-1",
        reason: "password",
      }),
    );
  });

  it("password account: wrong password returns 400 'Senha incorreta.' and does not remove factors", async () => {
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
    expect(mockClearFactors).not.toHaveBeenCalled();
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
    expect(mockClearFactors).not.toHaveBeenCalled();
  });

  it("google-only account: code alone removes native factor (no password needed)", async () => {
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

    expect(json).toHaveBeenCalledWith({ success: true });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockClearFactors).toHaveBeenCalledWith("user-2", {
      includeWhatsapp: false,
    });
    expect(mockWriteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "mfa_totp_recovery_with_code",
        reason: "google_code_only",
      }),
    );
  });

  it("invalid code returns generic 400 and does not remove factors", async () => {
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
    expect(mockClearFactors).not.toHaveBeenCalled();
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
    expect(mockClearFactors).not.toHaveBeenCalled();
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
    expect(mockClearFactors).not.toHaveBeenCalled();
  });
});
