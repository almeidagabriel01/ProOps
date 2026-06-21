// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

/**
 * Regression coverage for the SuperAdmin "Cancelado -> Ativo" flip.
 *
 * The bug: the onSnapshot listener applied the FIRST snapshot (still carrying the
 * stale tenant doc) and wrote the RAW subscriptionStatus, flipping a cancelled
 * card to green "Ativo". The fix gates application on the billing sync actually
 * landing (billingSyncedAt advancing) and always normalizes via the shared
 * deriveSubscriptionDisplayStatus.
 */

let snapshotCb: ((snap: unknown) => void) | null = null;
const unsub = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => ({ path: args.join("/") }),
  onSnapshot: (_ref: unknown, onNext: (snap: unknown) => void) => {
    snapshotCb = onNext;
    return unsub;
  },
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ setViewingTenant: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const getTenantsBillingPage = vi.fn();
vi.mock("@/services/admin-service", () => ({
  AdminService: {
    getTenantsBillingPage: (...args: unknown[]) => getTenantsBillingPage(...args),
  },
}));

import { useTenantManagement } from "../useTenantManagement";

const BASELINE = "2026-06-21T10:00:00.000Z";

function staleTenant() {
  return {
    tenant: { id: "t1", name: "Empresa Cortina", createdAt: "2026-03-18" },
    admin: {
      id: "u1",
      email: "a@b.com",
      currentPeriodEnd: "2026-06-19T00:00:00.000Z",
      subscription: {
        status: "active",
        currentPeriodEnd: "2026-06-19T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      },
    },
    planName: "Pro",
    planId: "pro",
    // Server's initial best-effort display status (legacy user-doc fallback).
    subscriptionStatus: "inactive",
    billingInterval: "monthly",
    isBillingStale: true,
    billingSyncedAt: BASELINE,
    usage: {
      users: 0,
      proposals: 0,
      clients: 0,
      products: 0,
      transactions: 0,
      wallets: 0,
      calendarEvents: 0,
    },
  };
}

function snap(data: Record<string, unknown>) {
  return { exists: () => true, data: () => data };
}

beforeEach(() => {
  snapshotCb = null;
  unsub.mockClear();
  getTenantsBillingPage.mockReset();
  getTenantsBillingPage.mockResolvedValue({
    items: [staleTenant()],
    nextCursor: null,
    hasMore: false,
  });
});

async function mounted() {
  const hook = renderHook(() => useTenantManagement());
  await waitFor(() =>
    expect(hook.result.current.tenantsData.length).toBe(1),
  );
  await waitFor(() => expect(snapshotCb).toBeTruthy());
  return hook;
}

describe("useTenantManagement — billing snapshot gating", () => {
  it("ignores a premature snapshot (sync not landed) and does NOT flip to raw active", async () => {
    const { result } = await mounted();
    expect(result.current.tenantsData[0].subscriptionStatus).toBe("inactive");

    // Same billingSyncedAt as baseline => the triggering sync has not landed.
    act(() => {
      snapshotCb!(
        snap({
          subscriptionStatus: "active",
          billingSyncedAt: BASELINE,
          plan: "pro",
          currentPeriodEnd: "2026-06-19T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        }),
      );
    });

    expect(result.current.tenantsData[0].subscriptionStatus).toBe("inactive");
    expect(result.current.tenantsData[0].isBillingStale).toBe(true);
  });

  it("applies and normalizes once the sync lands (canceled wins)", async () => {
    const { result } = await mounted();

    act(() => {
      snapshotCb!(
        snap({
          subscriptionStatus: "canceled",
          billingSyncedAt: "2026-06-21T10:05:00.000Z",
          plan: "pro",
          currentPeriodEnd: "2026-06-19T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        }),
      );
    });

    expect(result.current.tenantsData[0].subscriptionStatus).toBe("canceled");
    expect(result.current.tenantsData[0].isBillingStale).toBe(false);
  });

  it("shows canceled (not free) when sync downgraded plan to free but status is canceled", async () => {
    const { result } = await mounted();

    // Real scenario: cancel-at-period-end Pro lapsed; billing sync wrote
    // subscriptionStatus=canceled and plan=free (price did not map to a tier).
    // The plan tier must NOT mask the cancellation as "Gratuito".
    act(() => {
      snapshotCb!(
        snap({
          subscriptionStatus: "canceled",
          billingSyncedAt: "2026-06-21T10:05:00.000Z",
          plan: "free",
          currentPeriodEnd: "2026-06-19T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        }),
      );
    });

    expect(result.current.tenantsData[0].subscriptionStatus).toBe("canceled");
  });

  it("normalizes a landed raw active whose cancel-at-period-end has lapsed to canceled", async () => {
    const { result } = await mounted();

    act(() => {
      snapshotCb!(
        snap({
          subscriptionStatus: "active",
          billingSyncedAt: "2026-06-21T10:05:00.000Z",
          plan: "pro",
          currentPeriodEnd: "2026-06-11T00:00:00.000Z",
          cancelAtPeriodEnd: true,
        }),
      );
    });

    expect(result.current.tenantsData[0].subscriptionStatus).toBe("canceled");
  });

  it("keeps a genuinely active subscription active after the sync lands", async () => {
    const { result } = await mounted();

    act(() => {
      snapshotCb!(
        snap({
          subscriptionStatus: "active",
          billingSyncedAt: "2026-06-21T10:05:00.000Z",
          plan: "pro",
          currentPeriodEnd: "2099-01-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        }),
      );
    });

    expect(result.current.tenantsData[0].subscriptionStatus).toBe("active");
  });
});
