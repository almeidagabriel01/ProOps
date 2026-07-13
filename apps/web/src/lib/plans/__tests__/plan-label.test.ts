// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

// plan-label imports the plan-service (which initializes Firebase). Stub it —
// getImmediatePlanLabel only needs STATIC_PLAN_LABELS (local) and DEFAULT_PLANS.
vi.mock("@/services/plan-service", () => ({ PlanService: {}, DEFAULT_PLANS: [] }));

import { getImmediatePlanLabel } from "@/lib/plans/plan-label";

describe("getImmediatePlanLabel", () => {
  // Regression: a churned trial is demoted to role "free" but the cancel handler
  // leaves a "starter" planId. A free account is a free-tier/demo account — its
  // plan must read "Gratuito", never "Starter".
  it("returns 'Gratuito' for a free account even with a leftover 'starter' planId", () => {
    expect(getImmediatePlanLabel({ role: "free", planId: "starter" })).toBe(
      "Gratuito",
    );
  });

  it("returns 'Gratuito' for a free account with no planId", () => {
    expect(getImmediatePlanLabel({ role: "free" })).toBe("Gratuito");
    expect(getImmediatePlanLabel({ role: "free", planId: null })).toBe(
      "Gratuito",
    );
  });

  it("returns 'Super Admin' for superadmin regardless of planId", () => {
    expect(
      getImmediatePlanLabel({ role: "superadmin", planId: "pro" }),
    ).toBe("Super Admin");
  });

  it("returns the plan label for a paying role", () => {
    expect(getImmediatePlanLabel({ role: "admin", planId: "starter" })).toBe(
      "Starter",
    );
    expect(getImmediatePlanLabel({ role: "admin", planId: "pro" })).toBe(
      "Profissional",
    );
  });

  it("prefers an explicit preferredLabel", () => {
    expect(
      getImmediatePlanLabel({
        role: "free",
        planId: "starter",
        preferredLabel: "Plano Especial",
      }),
    ).toBe("Plano Especial");
  });
});
