import {
  AI_LIMITS,
  type ModelSelection,
  type TenantPlanTier,
} from "./ai.types";

/**
 * Select the appropriate Gemini model based on plan tier.
 *
 * @param planTier - The tenant's plan tier (free throws, starter/pro/enterprise selects)
 * @returns ModelSelection with model name, tier, limits, and history config
 * @throws Error with message for free tier ("Plano Free nao tem acesso a Lia...")
 */
export function selectModel(planTier: TenantPlanTier): ModelSelection {
  if (planTier === "free") {
    throw new Error(
      "Plano Free não tem acesso à Lia. Faça upgrade para Starter ou superior.",
    );
  }

  const config = AI_LIMITS[planTier];

  return {
    modelName: config.model,
    tier: planTier,
    messagesPerMonth: config.messagesPerMonth,
    persistHistory: config.persistHistory,
  };
}
