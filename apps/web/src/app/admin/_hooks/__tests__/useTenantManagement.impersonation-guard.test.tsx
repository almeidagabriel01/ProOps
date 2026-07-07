// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

/**
 * Regression: superadmin clicking "Acessar Painel" on a free-tier tenant
 * entered the ERP. Besides the disabled button in TenantCard, handleLoginAs
 * itself must refuse to impersonate a free tenant (defense in depth — the
 * guard holds even if the UI disabled state is bypassed).
 */

const setViewingTenant = vi.fn();
const routerPush = vi.fn();
const toastError = vi.fn();
const toastInfo = vi.fn();

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => ({ path: args.join("/") }),
  onSnapshot: () => vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/providers/tenant-provider", () => ({
  useTenant: () => ({ setViewingTenant }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));
vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: vi.fn(),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

const getTenantsBillingPage = vi.fn();
vi.mock("@/services/admin-service", () => ({
  AdminService: {
    getTenantsBillingPage: (...args: unknown[]) => getTenantsBillingPage(...args),
  },
}));

import { useTenantManagement } from "../useTenantManagement";
import type { TenantBillingInfo } from "@/services/admin-service";

function billingInfo(overrides: {
  planId?: string;
  planName: string;
  subscriptionStatus?: string;
}): TenantBillingInfo {
  return {
    tenant: { id: "t1", name: "Empresa Teste", createdAt: "2026-03-18" },
    admin: { id: "u1", email: "a@b.com" },
    planName: overrides.planName,
    planId: overrides.planId,
    subscriptionStatus: overrides.subscriptionStatus,
    billingInterval: "monthly",
    usage: {
      users: 0,
      proposals: 0,
      clients: 0,
      products: 0,
      transactions: 0,
      wallets: 0,
      calendarEvents: 0,
    },
  } as TenantBillingInfo;
}

beforeEach(() => {
  setViewingTenant.mockClear();
  routerPush.mockClear();
  toastError.mockClear();
  toastInfo.mockClear();
  getTenantsBillingPage.mockReset();
  getTenantsBillingPage.mockResolvedValue({
    items: [],
    nextCursor: null,
    hasMore: false,
  });
});

async function mounted() {
  const hook = renderHook(() => useTenantManagement());
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("useTenantManagement — free-plan impersonation guard", () => {
  it("blocks impersonation of a free tenant (exact reported scenario)", async () => {
    const { result } = await mounted();

    act(() => {
      result.current.handleLoginAs(
        billingInfo({ planId: "free", planName: "Gratuito", subscriptionStatus: "free" }),
      );
    });

    expect(setViewingTenant).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("blocks a free tenant even without planId (fallback via display status)", async () => {
    const { result } = await mounted();

    act(() => {
      result.current.handleLoginAs(
        billingInfo({ planName: "Gratuito", subscriptionStatus: "free" }),
      );
    });

    expect(setViewingTenant).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("is idempotent: repeated clicks on a free tenant never leak into the ERP", async () => {
    const { result } = await mounted();
    const free = billingInfo({ planId: "free", planName: "Gratuito" });

    act(() => {
      result.current.handleLoginAs(free);
      result.current.handleLoginAs(free);
      result.current.handleLoginAs(free);
    });

    expect(setViewingTenant).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it.each(["starter", "pro", "enterprise"])(
    "allows impersonation of a paid %s tenant",
    async (planId) => {
      const { result } = await mounted();

      act(() => {
        result.current.handleLoginAs(
          billingInfo({ planId, planName: planId, subscriptionStatus: "active" }),
        );
      });

      expect(setViewingTenant).toHaveBeenCalledTimes(1);
      expect(setViewingTenant).toHaveBeenCalledWith(
        expect.objectContaining({ id: "t1" }),
      );
      expect(routerPush).toHaveBeenCalledWith("/dashboard");
      expect(toastError).not.toHaveBeenCalled();
    },
  );

  it("still allows a canceled paid tenant only when its plan is not free", async () => {
    const { result } = await mounted();

    // Downgraded-after-cancel: plan=free wins → blocked.
    act(() => {
      result.current.handleLoginAs(
        billingInfo({ planId: "free", planName: "Pro", subscriptionStatus: "canceled" }),
      );
    });
    expect(setViewingTenant).not.toHaveBeenCalled();

    // Canceled but plan still pro → allowed (support/debug access).
    act(() => {
      result.current.handleLoginAs(
        billingInfo({ planId: "pro", planName: "Pro", subscriptionStatus: "canceled" }),
      );
    });
    expect(setViewingTenant).toHaveBeenCalledTimes(1);
  });
});
