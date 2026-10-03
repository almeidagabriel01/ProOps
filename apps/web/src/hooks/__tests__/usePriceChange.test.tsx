// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

/**
 * O writer único grava o preço cobrado hoje na RAIZ do tenant (`unitAmount`).
 * O hook lia só `tenant.subscription.unitAmount`, mapa que não é mais gravado,
 * e por isso a faixa de mudança de preço nunca aparecia.
 */

let mockUser: Record<string, unknown> | null = null;
let mockTenant: Record<string, unknown> | null = null;

vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: mockUser }) }));
vi.mock("@/providers/tenant-provider", () => ({ useTenant: () => ({ tenant: mockTenant }) }));
vi.mock("@/services/plan-service", () => ({
  PlanService: {
    getLivePlans: async () => [{ id: "pro", tier: "pro", pricing: { monthly: 249.9, yearly: 2499 } }],
  },
}));

import { usePriceChange } from "../usePriceChange";

beforeEach(() => {
  mockUser = { planId: "pro" };
  mockTenant = null;
});

describe("usePriceChange", () => {
  it("detecta a mudança de preço lendo o unitAmount da raiz do tenant", async () => {
    mockTenant = {
      stripeSubscriptionId: "sub_1",
      unitAmount: 19990,
      billingInterval: "monthly",
      currentPeriodEnd: "2027-09-20T12:00:00.000Z",
    };
    const { result } = renderHook(() => usePriceChange());
    await waitFor(() => expect(result.current.hasDrift).toBe(true));
    expect(result.current.renewalDate?.toISOString()).toBe("2027-09-20T12:00:00.000Z");
  });

  it("mesmo preço não mostra nada", async () => {
    mockTenant = { stripeSubscriptionId: "sub_1", unitAmount: 24990 };
    const { result } = renderHook(() => usePriceChange());
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.hasDrift).toBe(false);
  });

  it("contrato manual fica de fora", async () => {
    mockTenant = { stripeSubscriptionId: "sub_old", isManualSubscription: true, unitAmount: 19990 };
    const { result } = renderHook(() => usePriceChange());
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.hasDrift).toBe(false);
  });

  it("doc antigo com o mapa aninhado continua funcionando", async () => {
    mockUser = { planId: "pro", stripeSubscriptionId: "sub_1" };
    mockTenant = { subscription: { unitAmount: 19990 } };
    const { result } = renderHook(() => usePriceChange());
    await waitFor(() => expect(result.current.hasDrift).toBe(true));
  });
});
