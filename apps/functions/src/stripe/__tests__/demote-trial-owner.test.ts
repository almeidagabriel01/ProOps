/**
 * Unit tests for demoteTrialOwnerToFree — reverses the free-owner → admin
 * promotion when a 7-day trial churns without ever converting to a paid plan,
 * so the account lands in the read-only demo mode (role "free").
 */

const getUser = jest.fn();
const setCustomUserClaims = jest.fn();
const revokeRefreshTokens = jest.fn();
const userUpdate = jest.fn();
const userGet = jest.fn();
const doc = jest.fn(() => ({ get: userGet, update: userUpdate }));
const collection = jest.fn(() => ({ doc }));

jest.mock("../../init", () => ({
  db: { collection: (...a: unknown[]) => collection(...(a as [])) },
  auth: {
    getUser: (...a: unknown[]) => getUser(...(a as [])),
    setCustomUserClaims: (...a: unknown[]) => setCustomUserClaims(...(a as [])),
    revokeRefreshTokens: (...a: unknown[]) => revokeRefreshTokens(...(a as [])),
  },
  adminApp: {},
}));
// Heavy siblings pulled in transitively by stripeHelpers — stub them out.
jest.mock("../stripeConfig", () => ({ getStripe: jest.fn() }));
jest.mock("../stripeWebhook", () => ({ syncTenantPlanBillingSnapshot: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__ts__" },
}));

import { demoteTrialOwnerToFree } from "../stripeHelpers";

function mockUser(data: Record<string, unknown> | null) {
  userGet.mockResolvedValue({
    exists: data !== null,
    data: () => data ?? undefined,
  });
  getUser.mockResolvedValue({ customClaims: { tenantId: "t1", role: "ADMIN" } });
  userUpdate.mockResolvedValue(undefined);
  setCustomUserClaims.mockResolvedValue(undefined);
  revokeRefreshTokens.mockResolvedValue(undefined);
}

beforeEach(() => {
  [getUser, setCustomUserClaims, revokeRefreshTokens, userUpdate, userGet, doc, collection].forEach(
    (m) => m.mockReset(),
  );
  doc.mockReturnValue({ get: userGet, update: userUpdate });
  collection.mockReturnValue({ doc });
});

describe("demoteTrialOwnerToFree", () => {
  test("promoted owner (admin, no masterId) → flips role to free + claims + revoke", async () => {
    mockUser({ role: "admin", tenantId: "t1" });
    await demoteTrialOwnerToFree("u1");

    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ role: "free" }),
    );
    expect(setCustomUserClaims).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ role: "free", tenantId: "t1" }),
    );
    expect(revokeRefreshTokens).toHaveBeenCalledWith("u1");
  });

  test("team member (admin WITH masterId) → untouched", async () => {
    mockUser({ role: "admin", masterId: "owner-1", tenantId: "t1" });
    await demoteTrialOwnerToFree("u1");
    expect(userUpdate).not.toHaveBeenCalled();
    expect(setCustomUserClaims).not.toHaveBeenCalled();
  });

  test("master role → untouched (only admins are demoted)", async () => {
    mockUser({ role: "master", tenantId: "t1" });
    await demoteTrialOwnerToFree("u1");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  test("already free → untouched (idempotent)", async () => {
    mockUser({ role: "free", tenantId: "t1" });
    await demoteTrialOwnerToFree("u1");
    expect(userUpdate).not.toHaveBeenCalled();
  });

  test("non-existent user → no-op", async () => {
    mockUser(null);
    await demoteTrialOwnerToFree("u1");
    expect(userUpdate).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
});
