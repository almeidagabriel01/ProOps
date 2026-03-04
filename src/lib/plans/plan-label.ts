"use client";

import { PlanService, DEFAULT_PLANS } from "@/services/plan-service";

const STATIC_PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  starter: "Starter",
  pro: "Profissional",
  enterprise: "Enterprise",
};

const planLabelCache = new Map<string, string>();

function normalizePlanKey(value?: string | null): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || null;
}

export function getImmediatePlanLabel(input: {
  role?: string | null;
  planId?: string | null;
  preferredLabel?: string | null;
}): string | null {
  const preferredLabel = String(input.preferredLabel || "").trim();
  if (preferredLabel) {
    return preferredLabel;
  }

  const role = String(input.role || "").trim().toLowerCase();
  if (role === "superadmin") {
    return "Super Admin";
  }

  const normalizedPlanId = normalizePlanKey(input.planId);
  if (!normalizedPlanId) {
    return role === "free" ? "Gratuito" : "Sem Plano";
  }

  const staticLabel = STATIC_PLAN_LABELS[normalizedPlanId];
  if (staticLabel) {
    return staticLabel;
  }

  const defaultPlan = DEFAULT_PLANS.find((plan) => plan.tier === normalizedPlanId);
  if (defaultPlan?.name) {
    return defaultPlan.name;
  }

  const cachedLabel = planLabelCache.get(normalizedPlanId);
  return cachedLabel || null;
}

export async function resolvePlanLabel(planId?: string | null): Promise<string | null> {
  const normalizedPlanId = normalizePlanKey(planId);
  if (!normalizedPlanId) {
    return null;
  }

  const immediateLabel = getImmediatePlanLabel({ planId: normalizedPlanId });
  if (immediateLabel && immediateLabel !== "Sem Plano") {
    planLabelCache.set(normalizedPlanId, immediateLabel);
    return immediateLabel;
  }

  try {
    const plan = await PlanService.getPlanById(normalizedPlanId);
    if (plan?.name) {
      planLabelCache.set(normalizedPlanId, plan.name);
      const normalizedTier = normalizePlanKey(plan.tier);
      if (normalizedTier) {
        planLabelCache.set(normalizedTier, plan.name);
      }
      return plan.name;
    }
  } catch (error) {
    console.error("Failed to resolve plan label:", error);
  }

  return null;
}
