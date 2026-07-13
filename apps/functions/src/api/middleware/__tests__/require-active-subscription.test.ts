/**
 * Unit tests for the requireActiveSubscription middleware, focused on:
 *  - trialing tenants pass (fast-allow)
 *  - free-tier / demo accounts: GET on ERP read routes passes, but every
 *    mutation (POST/PUT/DELETE) and non-demo GET is blocked with 402.
 */

const getTenantDocCached = jest.fn();

jest.mock("../../../lib/tenant-doc-cache", () => ({
  getTenantDocCached: (...a: unknown[]) => getTenantDocCached(...a),
  invalidateTenantDoc: jest.fn(),
}));
jest.mock("../../../lib/tenant-plan-policy", () => ({
  // Not exercised for the free/trialing paths, but keep a permissive default.
  evaluateSubscriptionStatusAccess: () => ({ allowWrite: true, reasonCode: "SUBSCRIPTION_OK" }),
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../lib/security-observability", () => ({
  buildSecurityLogContext: () => ({}),
  writeSecurityAuditEvent: jest.fn(),
}));

import { requireActiveSubscription } from "../require-active-subscription";

type MockUser = {
  uid: string;
  tenantId: string;
  role: string;
  isSuperAdmin?: boolean;
  hasRequiredClaims?: boolean;
};

function makeReq(path: string, method: string, user: MockUser) {
  return { path, method, user } as never;
}

function makeRes() {
  const res: { statusCode?: number; body?: unknown; status: jest.Mock; json: jest.Mock } = {
    status: jest.fn().mockImplementation((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn().mockImplementation((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

async function run(path: string, method: string, user: MockUser, tenantStatus = "free") {
  getTenantDocCached.mockResolvedValue({
    exists: true,
    data: { subscriptionStatus: tenantStatus, pastDueSince: null },
  });
  const req = makeReq(path, method, user);
  const res = makeRes();
  const next = jest.fn();
  await requireActiveSubscription(req, res as never, next as never);
  return { res, next };
}

const freeUser: MockUser = {
  uid: "u-free",
  tenantId: "tenant-free",
  role: "free",
  hasRequiredClaims: true,
};

const paidTrialUser: MockUser = {
  uid: "u-trial",
  tenantId: "tenant-trial",
  role: "MASTER",
  hasRequiredClaims: true,
};

beforeEach(() => {
  getTenantDocCached.mockReset();
});

describe("free-tier demo mode gate", () => {
  test("free user GET on a demo-readable ERP route → allowed", async () => {
    const { res, next } = await run("/v1/products", "GET", freeUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("free user GET /v1/proposals/xyz → allowed", async () => {
    const { next } = await run("/v1/proposals/xyz", "GET", freeUser);
    expect(next).toHaveBeenCalled();
  });

  test.each(["POST", "PUT", "DELETE", "PATCH"])(
    "free user %s on an ERP route → 402 FREE_TIER_FORBIDDEN",
    async (method) => {
      const { res, next } = await run("/v1/products", method, freeUser);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(402);
      expect((res.body as { code: string }).code).toBe("FREE_TIER_FORBIDDEN");
    },
  );

  test("free user GET on a NON-demo route → 402", async () => {
    const { res, next } = await run("/v1/team", "GET", freeUser);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
  });

  test("free user GET on an allowed profile route → allowed", async () => {
    const { res, next } = await run("/v1/profile", "GET", freeUser);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("trialing tenants keep full access", () => {
  test("paid-role user with trialing status → allowed (write route)", async () => {
    const { res, next } = await run("/v1/products", "POST", paidTrialUser, "trialing");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
