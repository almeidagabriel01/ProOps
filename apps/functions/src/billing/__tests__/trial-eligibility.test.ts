/**
 * Unit tests for the 7-day trial eligibility helpers (one-trial-per-account
 * anti-abuse). Covers reserveTrialSlot (TOCTOU-safe reservation) and
 * hasEmailUsedTrial (same-email dedup).
 */

// The module under test imports `db` from ../init — provide a controllable mock.
const runTransaction = jest.fn();
const collection = jest.fn();

jest.mock("../../init", () => ({
  db: {
    runTransaction: (...args: unknown[]) => runTransaction(...args),
    collection: (...args: unknown[]) => collection(...args),
  },
  auth: {},
  adminApp: {},
}));

import {
  reserveTrialSlot,
  hasEmailUsedTrial,
  PRO_TRIAL_DAYS,
  TRIAL_RESERVATION_TTL_MINUTES,
} from "../trial-eligibility";

/**
 * Drives reserveTrialSlot by simulating the transaction callback against a
 * given tenant snapshot. Returns { result, setCalled }.
 */
async function runReserve(tenantData: Record<string, unknown> | null) {
  const txSet = jest.fn();
  const tx = {
    get: jest.fn().mockResolvedValue({
      exists: tenantData !== null,
      data: () => tenantData ?? undefined,
    }),
    set: txSet,
  };
  const docRef = { id: "tenant-x" };
  collection.mockReturnValue({ doc: jest.fn().mockReturnValue(docRef) });
  runTransaction.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx));

  const result = await reserveTrialSlot("tenant-x");
  return { result, setCalled: txSet.mock.calls.length > 0 };
}

beforeEach(() => {
  runTransaction.mockReset();
  collection.mockReset();
});

describe("constants", () => {
  test("trial is 7 days", () => expect(PRO_TRIAL_DAYS).toBe(7));
  test("reservation TTL is 30 minutes", () =>
    expect(TRIAL_RESERVATION_TTL_MINUTES).toBe(30));
});

describe("reserveTrialSlot", () => {
  test("fresh tenant → reserves the slot", async () => {
    const { result, setCalled } = await runReserve({});
    expect(result).toBe(true);
    expect(setCalled).toBe(true);
  });

  test("tenant that already used a trial → ineligible, no write", async () => {
    const { result, setCalled } = await runReserve({
      trialUsedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result).toBe(false);
    expect(setCalled).toBe(false);
  });

  test("tenant with an existing subscription → ineligible", async () => {
    const { result } = await runReserve({ stripeSubscriptionId: "sub_123" });
    expect(result).toBe(false);
  });

  test("non-existent tenant → ineligible", async () => {
    const { result } = await runReserve(null);
    expect(result).toBe(false);
  });

  test("active unexpired reservation → ineligible (race / concurrent checkout)", async () => {
    const { result } = await runReserve({
      trialReservedAt: new Date().toISOString(),
    });
    expect(result).toBe(false);
  });

  test("expired reservation → re-reserves the slot", async () => {
    const expired = new Date(
      Date.now() - (TRIAL_RESERVATION_TTL_MINUTES + 5) * 60 * 1000,
    ).toISOString();
    const { result, setCalled } = await runReserve({ trialReservedAt: expired });
    expect(result).toBe(true);
    expect(setCalled).toBe(true);
  });
});

describe("hasEmailUsedTrial", () => {
  function mockUsersAndTenants(
    userDocs: Array<Record<string, unknown>>,
    tenantsById: Record<string, Record<string, unknown> | null>,
  ) {
    collection.mockImplementation((name: string) => {
      if (name === "users") {
        return {
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              get: jest.fn().mockResolvedValue({
                docs: userDocs.map((d) => ({ data: () => d })),
              }),
            }),
          }),
        };
      }
      // tenants
      return {
        doc: jest.fn((id: string) => ({
          get: jest.fn().mockResolvedValue({
            exists: tenantsById[id] != null,
            data: () => tenantsById[id] ?? undefined,
          }),
        })),
      };
    });
  }

  test("empty / invalid email → false without querying", async () => {
    expect(await hasEmailUsedTrial("")).toBe(false);
    expect(await hasEmailUsedTrial("not-an-email")).toBe(false);
    expect(collection).not.toHaveBeenCalled();
  });

  test("email whose tenant already used a trial → true", async () => {
    mockUsersAndTenants(
      [{ email: "a@b.com", tenantId: "tenant-a" }],
      { "tenant-a": { trialUsedAt: "2026-01-01T00:00:00.000Z" } },
    );
    expect(await hasEmailUsedTrial("A@B.com")).toBe(true);
  });

  test("email whose tenant never used a trial → false", async () => {
    mockUsersAndTenants(
      [{ email: "a@b.com", tenantId: "tenant-a" }],
      { "tenant-a": {} },
    );
    expect(await hasEmailUsedTrial("a@b.com")).toBe(false);
  });

  test("falls back to companyId when tenantId absent", async () => {
    mockUsersAndTenants(
      [{ email: "a@b.com", companyId: "tenant-legacy" }],
      { "tenant-legacy": { trialUsedAt: "2026-01-01T00:00:00.000Z" } },
    );
    expect(await hasEmailUsedTrial("a@b.com")).toBe(true);
  });
});
