/**
 * Unit tests for dev-mfa-bypass.controller.ts — the LOCAL DEV ONLY superadmin
 * TOTP bypass. Asserts the triple gate (flag + project + localhost), the
 * superadmin-only + password authorization, and the account preparation
 * (unenroll TOTP + set the `dev_mfa_bypass` claim). The localhost signal must
 * come from `x-forwarded-host` (what the Next.js /api/backend proxy forwards),
 * e.g. `localhost:3000`.
 */

process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";

const docStore = new Map<string, Record<string, unknown> | undefined>();

const mockGetUserByEmail = jest.fn();
const mockUpdateUser = jest.fn();
const mockSetCustomUserClaims = jest.fn();
jest.mock("../../../init", () => ({
  auth: {
    getUserByEmail: (...args: unknown[]) => mockGetUserByEmail(...args),
    updateUser: (...args: unknown[]) => mockUpdateUser(...args),
    setCustomUserClaims: (...args: unknown[]) => mockSetCustomUserClaims(...args),
  },
  db: {
    collection: (collection: string) => ({
      doc: (id: string) => ({
        get: jest.fn(async () => {
          const data = docStore.get(`${collection}/${id}`);
          return { exists: data !== undefined, data: () => data };
        }),
      }),
    }),
  },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockWriteAudit = jest.fn();
jest.mock("../../../lib/security-observability", () => ({
  writeSecurityAuditEvent: (...args: unknown[]) => mockWriteAudit(...args),
}));

// recovery-codes.controller (imported for shared helpers) pulls in the email
// sender — mock it so no Resend client is constructed during the test.
jest.mock("../../../services/email/send-email", () => ({
  sendEmail: jest.fn(),
}));

import type { Request, Response } from "express";
import { devMfaBypass } from "../dev-mfa-bypass.controller";

const PASSWORD_PROVIDER = [{ providerId: "password" }];

function makeReq(body: unknown, headers: Record<string, string>): Request {
  return {
    body,
    path: "/v1/auth/dev-mfa-bypass",
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;
}

function makeRes(): { res: Response; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

const LOCALHOST_HEADERS = { "x-forwarded-host": "localhost:3000" };

function setSuperAdmin(email: string) {
  mockGetUserByEmail.mockResolvedValue({
    uid: "uid-super",
    email,
    providerData: PASSWORD_PROVIDER,
    customClaims: { role: "superadmin" },
  });
  docStore.set("users/uid-super", { tenantId: "", role: "superadmin" });
}

const globalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  docStore.clear();
  process.env.DEV_MFA_BYPASS_ENABLED = "true";
  process.env.GCLOUD_PROJECT = "erp-softcode";
  mockUpdateUser.mockResolvedValue(undefined);
  mockSetCustomUserClaims.mockResolvedValue(undefined);
  // Password REST check succeeds by default (HTTP 200).
  global.fetch = jest.fn(async () => ({ status: 200 })) as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = globalFetch;
});

describe("devMfaBypass — gate", () => {
  test("404 when the flag is off", async () => {
    process.env.DEV_MFA_BYPASS_ENABLED = "false";
    setSuperAdmin("super@softcode.com");
    const { res, status } = makeRes();
    await devMfaBypass(
      makeReq({ email: "super@softcode.com", password: "pw" }, LOCALHOST_HEADERS),
      res,
    );
    expect(status).toHaveBeenCalledWith(404);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test("404 in the prod project even with the flag on", async () => {
    process.env.GCLOUD_PROJECT = "erp-softcode-prod";
    setSuperAdmin("super@softcode.com");
    const { res, status } = makeRes();
    await devMfaBypass(
      makeReq({ email: "super@softcode.com", password: "pw" }, LOCALHOST_HEADERS),
      res,
    );
    expect(status).toHaveBeenCalledWith(404);
  });

  test("404 when the request is not from localhost", async () => {
    setSuperAdmin("super@softcode.com");
    const { res, status } = makeRes();
    await devMfaBypass(
      makeReq(
        { email: "super@softcode.com", password: "pw" },
        { "x-forwarded-host": "app.proops.com.br" },
      ),
      res,
    );
    expect(status).toHaveBeenCalledWith(404);
  });
});

describe("devMfaBypass — authorization", () => {
  test("403 for a non-superadmin account", async () => {
    mockGetUserByEmail.mockResolvedValue({
      uid: "uid-a",
      email: "user@x.com",
      providerData: PASSWORD_PROVIDER,
      customClaims: { role: "admin" },
    });
    docStore.set("users/uid-a", { tenantId: "t-a", role: "admin" });
    const { res, status } = makeRes();
    await devMfaBypass(
      makeReq({ email: "user@x.com", password: "pw" }, LOCALHOST_HEADERS),
      res,
    );
    expect(status).toHaveBeenCalledWith(403);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test("400 on a wrong password", async () => {
    setSuperAdmin("super@softcode.com");
    global.fetch = jest.fn(async () => ({ status: 400 })) as unknown as typeof fetch;
    const { res, status } = makeRes();
    await devMfaBypass(
      makeReq({ email: "super@softcode.com", password: "wrong" }, LOCALHOST_HEADERS),
      res,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  test("unenrolls TOTP and sets the dev_mfa_bypass claim via localhost:3000", async () => {
    setSuperAdmin("super@softcode.com");
    const { res, json } = makeRes();
    await devMfaBypass(
      makeReq({ email: "super@softcode.com", password: "pw" }, LOCALHOST_HEADERS),
      res,
    );
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-super", {
      multiFactor: { enrolledFactors: null },
    });
    // Existing claims (role) preserved, dev_mfa_bypass added.
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-super", {
      role: "superadmin",
      dev_mfa_bypass: true,
    });
    expect(json).toHaveBeenCalledWith({ success: true });
  });
});
