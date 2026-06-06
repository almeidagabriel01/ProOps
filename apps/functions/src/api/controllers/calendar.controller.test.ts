/**
 * Integration tests for the refresh-token encryption wiring in
 * calendar.controller.ts (getGoogleIntegration read + auto-migration paths).
 *
 * These cover the layer where the previous bugs lived: the actual Firestore
 * `.set()` payload and the read -> decrypt handoff. Firestore and Cloud KMS are
 * mocked; the encrypt/decrypt mocks are reversible so round-trips are checked.
 */

jest.mock("../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockEncrypt = jest.fn(async (t: string) => `kms:v1:${t}`);
const mockDecrypt = jest.fn(async (c: string) => c.replace(/^kms:v1:/, ""));

jest.mock("../../lib/token-encryption", () => ({
  encryptToken: (t: string) => mockEncrypt(t),
  decryptToken: (c: string) => mockDecrypt(c),
  isEncryptedToken: (v: unknown) =>
    typeof v === "string" && v.startsWith("kms:v1:"),
}));

jest.mock("../../init", () => ({ db: { collection: jest.fn() } }));

import { getGoogleIntegration } from "./calendar.controller";
import { db } from "../../init";

const collectionMock = db.collection as unknown as jest.Mock;

interface LegacyDocData {
  tenantId: string;
  provider: string;
  enabled: boolean;
  calendarId: string;
  refreshToken?: string;
  refreshTokenEnc?: string | null;
  updatedAt: string;
}

function makeLegacyDoc(id: string, data: LegacyDocData) {
  return {
    id,
    data: () => data,
    ref: { delete: jest.fn(async () => undefined) },
    createTime: { toMillis: () => 0 },
  };
}

function setupDb(opts: {
  directData?: Record<string, unknown>;
  legacyDocs?: ReturnType<typeof makeLegacyDoc>[];
}) {
  const setSpy = jest.fn(
    async (_data?: unknown, _options?: unknown) => undefined,
  );
  const docRef = {
    get: jest.fn(async () => ({ id: "tenant-1", data: () => opts.directData })),
    set: setSpy,
  };
  const collectionObj: Record<string, unknown> = {
    doc: jest.fn(() => docRef),
    get: jest.fn(async () => ({
      empty: !(opts.legacyDocs && opts.legacyDocs.length),
      docs: opts.legacyDocs || [],
    })),
  };
  collectionObj.where = jest.fn(() => collectionObj);
  collectionMock.mockReturnValue(collectionObj);
  return { setSpy };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getGoogleIntegration — encryption wiring", () => {
  it("auto-migration of a legacy plaintext doc persists ONLY ciphertext (never plaintext)", async () => {
    const legacy = makeLegacyDoc("legacy-id", {
      tenantId: "tenant-1",
      provider: "google",
      enabled: true,
      calendarId: "primary",
      refreshToken: "legacy-plain",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    const { setSpy } = setupDb({ directData: undefined, legacyDocs: [legacy] });

    const result = await getGoogleIntegration("tenant-1");

    // The relocation write must encrypt before persisting.
    expect(mockEncrypt).toHaveBeenCalledWith("legacy-plain");
    expect(setSpy).toHaveBeenCalledTimes(1);
    const persisted = setSpy.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(persisted.refreshTokenEnc).toBe("kms:v1:legacy-plain");
    // The plaintext field is cleared — the bug was persisting it here.
    expect(persisted.refreshToken).toBe("");

    // Returned record exposes the usable (decrypted) token for downstream use.
    expect(result?.data.refreshToken).toBe("legacy-plain");
    expect(result?.data.refreshTokenEnc).toBe("kms:v1:legacy-plain");
    expect(legacy.ref.delete).toHaveBeenCalledTimes(1);
  });

  it("prioritizes the encrypted token and decrypts it when both coexist (no migration write)", async () => {
    setupDb({
      directData: {
        tenantId: "tenant-1",
        provider: "google",
        enabled: true,
        calendarId: "primary",
        refreshToken: "stale-plaintext",
        refreshTokenEnc: "kms:v1:real-token",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    });

    const result = await getGoogleIntegration("tenant-1");

    expect(mockDecrypt).toHaveBeenCalledWith("kms:v1:real-token");
    expect(result?.data.refreshToken).toBe("real-token");
    // The stale plaintext is ignored, never used.
    expect(result?.data.refreshToken).not.toBe("stale-plaintext");
  });

  it("auto-migration of an already-encrypted legacy doc carries ciphertext over without re-encrypting", async () => {
    const legacy = makeLegacyDoc("legacy-id", {
      tenantId: "tenant-1",
      provider: "google",
      enabled: true,
      calendarId: "primary",
      refreshToken: "",
      refreshTokenEnc: "kms:v1:already-enc",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });
    const { setSpy } = setupDb({ directData: undefined, legacyDocs: [legacy] });

    const result = await getGoogleIntegration("tenant-1");

    expect(mockEncrypt).not.toHaveBeenCalled();
    const persisted = setSpy.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(persisted.refreshTokenEnc).toBe("kms:v1:already-enc");
    expect(persisted.refreshToken).toBe("");
    expect(result?.data.refreshToken).toBe("already-enc");
  });
});
