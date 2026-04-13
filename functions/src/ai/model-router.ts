import {
  AI_LIMITS,
  ENTERPRISE_PRO_KEYWORDS,
  ENTERPRISE_PRO_MODEL,
  type ModelSelection,
  type TenantPlanTier,
} from "./ai.types";

/**
 * Select the appropriate Gemini model based on plan tier and message content.
 *
 * @param planTier - The tenant's plan tier (free throws, starter/pro/enterprise selects)
 * @param userMessage - The user's message text (used for Enterprise complexity routing)
 * @returns ModelSelection with model name, tier, limits, and history config
 * @throws Error with message for free tier ("Plano Free nao tem acesso a Lia...")
 */
export function selectModel(
  planTier: TenantPlanTier,
  userMessage?: string,
): ModelSelection {
  if (planTier === "free") {
    throw new Error(
      "Plano Free não tem acesso à Lia. Faça upgrade para Starter ou superior.",
    );
  }

  const config = AI_LIMITS[planTier];
  let modelName = config.model;

  // Enterprise: route complex queries to gemini-2.5-pro (~20% of requests)
  if (planTier === "enterprise" && userMessage) {
    const normalizedMessage = userMessage.toLowerCase();
    const isComplex = ENTERPRISE_PRO_KEYWORDS.some((keyword) =>
      normalizedMessage.includes(keyword),
    );
    if (isComplex) {
      modelName = ENTERPRISE_PRO_MODEL;
    }
  }

  return {
    modelName,
    tier: planTier,
    messagesPerMonth: config.messagesPerMonth,
    persistHistory: config.persistHistory,
  };
}
