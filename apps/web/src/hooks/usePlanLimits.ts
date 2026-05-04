"use client";

// Shim: re-export usePlanContext as usePlanLimits so all 30+ existing
// consumers continue to work without any changes. The actual state and
// fetch logic lives in src/providers/plan-provider.tsx and runs once
// per authenticated session instead of once per component instance.
export { usePlanContext as usePlanLimits } from "@/providers/plan-provider";
export type { AddonGracePeriodInfo } from "@/providers/plan-provider";

// DEFAULT_PLANS and FREE_PLAN_FEATURES were imported directly from
// plan-service.ts by some callers — keep that import path working.
export { DEFAULT_PLANS } from "@/services/plan-service";
