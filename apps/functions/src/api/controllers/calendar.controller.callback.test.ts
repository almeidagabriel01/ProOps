/**
 * Integration test for the OAuth callback wiring in calendar.controller.ts
 * (handleGoogleCalendarCallback -> encrypt -> persist).
 *
 * This is the path with no automated coverage until now and the one that must
 * never persist a plaintext refresh token. Firestore, Cloud KMS and googleapis
 * are mocked; the feature flag is enabled only for this test.
 */

import type { Request, Response } from "express";
import { randomUUID } from "crypto";

process.env.GOOGLE_CALENDAR_SYNC_ENABLED = "true";
process.env.GOOGLE_CALENDAR_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_CALENDAR_REDIRECT_URI =
  "https://dev.example.com/api/backend/v1/calendar/google/callback";

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

const mockGetToken = jest.fn();
const mockSetCredentials = jest.fn();
const mockUserinfoGet = jest.fn(async () => ({ data: { email: "user@example.com" } }));

jest.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        getToken: mockGetToken,
        setCredentials: mockSetCredentials,
        generateAuthUrl: jest.fn(() => "https://accounts.google.com/auth"),
      })),
    },
    oauth2: jest.fn(() => ({ userinfo: { get: mockUserinfoGet } })),
  },
}));

jest.mock("../../init", () => ({ db: { collection: jest.fn() } }));

import {
  handleGoogleCalendarCallback,
  buildFrontendCalendarUrl,
  resolveGoogleCalendarRedirectUri,
} from "./calendar.controller";
import { db } from "../../init";

const collectionMock = db.collection as unknown as jest.Mock;

function installDb(opts: { stateData?: unknown; existingIntegration?: unknown }) {
  const setIntegrationSpy = jest.fn(
    async (_data?: unknown, _options?: unknown) => undefined,
  );
  const stateDeleteSpy = jest.fn(async () => undefined);

  const integrationsDocRef = {
    get: jest.fn(async () => ({
      id: "tenant-1",
      data: () => opts.existingIntegration,
    })),
    set: setIntegrationSpy,
  };
  const statesDocRef = {
    get: jest.fn(async () => ({
      exists: opts.stateData !== undefined,
      data: () => opts.stateData,
    })),
    delete: stateDeleteSpy,
  };

  collectionMock.mockImplementation((name: string) => {
    if (name === "calendar_oauth_states") {
      return { doc: jest.fn(() => statesDocRef) };
    }
    // calendar_integrations
    const col: Record<string, unknown> = {
      doc: jest.fn(() => integrationsDocRef),
      get: jest.fn(async () => ({ empty: true, docs: [] })),
    };
    col.where = jest.fn(() => col);
    return col;
  });

  return { setIntegrationSpy, stateDeleteSpy };
}

const VALID_STATE = "11111111-1111-4111-8111-111111111111"; // valid v4 UUID

function makeReqRes() {
  const req = {
    query: { state: VALID_STATE, code: "auth-code" },
    headers: { host: "dev.example.com", "x-forwarded-proto": "https" },
  } as unknown as Request;
  const redirect = jest.fn();
  const res = {
    redirect,
    status: jest.fn(function status() {
      return res;
    }),
    json: jest.fn(function json() {
      return res;
    }),
  } as unknown as Response;
  return { req, res, redirect };
}

const FUTURE_MS = 9_999_999_999_999; // year ~2286, never expired

beforeEach(() => {
  jest.clearAllMocks();
});

describe("handleGoogleCalendarCallback — encrypt -> persist wiring", () => {
  it("persists ONLY the encrypted refresh token (plaintext field cleared)", async () => {
    mockGetToken.mockResolvedValueOnce({
      tokens: { refresh_token: "new-refresh-token" },
    });
    const { setIntegrationSpy, stateDeleteSpy } = installDb({
      stateData: { uid: "user-1", tenantId: "tenant-1", expiresAtMs: FUTURE_MS },
      existingIntegration: undefined,
    });
    const { req, res, redirect } = makeReqRes();

    await handleGoogleCalendarCallback(req, res);

    expect(mockEncrypt).toHaveBeenCalledWith("new-refresh-token");
    expect(setIntegrationSpy).toHaveBeenCalledTimes(1);
    const persisted = setIntegrationSpy.mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >;
    expect(persisted.refreshTokenEnc).toBe("kms:v1:new-refresh-token");
    expect(persisted.refreshToken).toBe("");
    expect(persisted.connectedEmail).toBe("user@example.com");

    expect(stateDeleteSpy).toHaveBeenCalledTimes(1); // one-time state consumed
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(String(redirect.mock.calls[0][0])).toContain("googleCalendar=connected");
  });

  it("reuses and re-encrypts the existing token when Google returns no refresh_token", async () => {
    mockGetToken.mockResolvedValueOnce({ tokens: {} }); // no refresh_token
    const { setIntegrationSpy } = installDb({
      stateData: { uid: "user-1", tenantId: "tenant-1", expiresAtMs: FUTURE_MS },
      existingIntegration: {
        tenantId: "tenant-1",
        provider: "google",
        enabled: true,
        calendarId: "primary",
        refreshToken: "",
        refreshTokenEnc: "kms:v1:old-token",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    });
    const { req, res } = makeReqRes();

    await handleGoogleCalendarCallback(req, res);

    // The existing token is decrypted for reuse, then re-encrypted on write.
    expect(mockDecrypt).toHaveBeenCalledWith("kms:v1:old-token");
    expect(mockEncrypt).toHaveBeenCalledWith("old-token");
    const persisted = setIntegrationSpy.mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >;
    expect(persisted.refreshTokenEnc).toBe("kms:v1:old-token");
    expect(persisted.refreshToken).toBe("");
  });

  it("redirects with an error when state or code is missing (no write)", async () => {
    const { setIntegrationSpy } = installDb({ stateData: undefined });
    const { req, res, redirect } = makeReqRes();
    (req as unknown as { query: Record<string, string> }).query = { state: "", code: "" };

    await handleGoogleCalendarCallback(req, res);

    expect(setIntegrationSpy).not.toHaveBeenCalled();
    expect(String(redirect.mock.calls[0][0])).toContain("googleCalendar=error");
  });
});

describe("handleGoogleCalendarCallback — M5 query validation (Zod)", () => {
  it("VALID: state(uuid) + code proceeds and persists", async () => {
    mockGetToken.mockResolvedValueOnce({ tokens: { refresh_token: "rt" } });
    const { setIntegrationSpy } = installDb({
      stateData: { uid: "u", tenantId: "tenant-1", expiresAtMs: FUTURE_MS },
    });
    const { req, res } = makeReqRes(); // VALID_STATE + code already

    await handleGoogleCalendarCallback(req, res);

    expect(setIntegrationSpy).toHaveBeenCalledTimes(1);
  });

  it("VALID: accepts a real crypto.randomUUID() state (generator <-> regex agree)", async () => {
    mockGetToken.mockResolvedValueOnce({ tokens: { refresh_token: "rt" } });
    const { setIntegrationSpy } = installDb({
      stateData: { uid: "u", tenantId: "tenant-1", expiresAtMs: FUTURE_MS },
    });
    const { req, res } = makeReqRes();
    (req as unknown as { query: Record<string, string> }).query = {
      state: randomUUID(), // the actual generator used by getGoogleCalendarAuthUrl
      code: "auth-code",
    };

    await handleGoogleCalendarCallback(req, res);

    expect(setIntegrationSpy).toHaveBeenCalledTimes(1);
  });

  it("ERROR: ?error=access_denied (consent declined) surfaces the reason, no write", async () => {
    const { setIntegrationSpy } = installDb({ stateData: undefined });
    const { req, res, redirect } = makeReqRes();
    (req as unknown as { query: Record<string, string> }).query = {
      state: VALID_STATE,
      error: "access_denied",
    };

    await handleGoogleCalendarCallback(req, res);

    expect(setIntegrationSpy).not.toHaveBeenCalled();
    const url = String(redirect.mock.calls[0][0]);
    expect(url).toContain("googleCalendar=error");
    expect(url).toContain("reason=access_denied"); // real reason, not "missing_code"
  });

  it("MALFORMED: non-UUID state is rejected (invalid_request), no write", async () => {
    const { setIntegrationSpy } = installDb({ stateData: undefined });
    const { req, res, redirect } = makeReqRes();
    (req as unknown as { query: Record<string, string> }).query = {
      state: "not-a-uuid",
      code: "x",
    };

    await handleGoogleCalendarCallback(req, res);

    expect(setIntegrationSpy).not.toHaveBeenCalled();
    expect(String(redirect.mock.calls[0][0])).toContain("reason=invalid_request");
  });

  it("MALFORMED: neither code nor error fails the refine (invalid_request)", async () => {
    const { setIntegrationSpy } = installDb({ stateData: undefined });
    const { req, res, redirect } = makeReqRes();
    (req as unknown as { query: Record<string, string> }).query = {
      state: VALID_STATE,
    };

    await handleGoogleCalendarCallback(req, res);

    expect(setIntegrationSpy).not.toHaveBeenCalled();
    expect(String(redirect.mock.calls[0][0])).toContain("reason=invalid_request");
  });
});

describe("M1 — OAuth/redirect origin never derives from request headers", () => {
  const originalRedirect = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const originalAppUrl = process.env.APP_URL;

  afterEach(() => {
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = originalRedirect;
    process.env.APP_URL = originalAppUrl;
  });

  it("buildFrontendCalendarUrl IGNORES a spoofed x-forwarded-host (uses APP_URL)", () => {
    process.env.APP_URL = "https://safe.example.com";
    const url = buildFrontendCalendarUrl(
      {
        headers: {
          "x-forwarded-host": "evil.example.com",
          host: "evil.example.com",
        },
      } as unknown as Request,
      "error",
      "boom",
    );

    expect(url).toContain("safe.example.com");
    expect(url).not.toContain("evil.example.com"); // <- fails on the old header-derived code
  });

  it("resolveGoogleCalendarRedirectUri uses GOOGLE_CALENDAR_REDIRECT_URI when set (override)", () => {
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://override.example.com/cb";
    expect(resolveGoogleCalendarRedirectUri()).toBe(
      "https://override.example.com/cb",
    );
  });

  it("resolveGoogleCalendarRedirectUri derives from APP_URL when no override is set", () => {
    delete process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    process.env.APP_URL = "https://safe.example.com";
    expect(resolveGoogleCalendarRedirectUri()).toBe(
      "https://safe.example.com/api/backend/v1/calendar/google/callback",
    );
  });
});
