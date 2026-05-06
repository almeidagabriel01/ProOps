import { db } from "../init";
import { logger } from "./logger";
import {
  clearTenantPlanCache,
  getTenantPlanProfile,
  type TenantPlanTier,
} from "./tenant-plan-policy";

const WHATSAPP_BASE_TIER: TenantPlanTier = "enterprise";

export type WhatsAppEligibilityReason =
  | "plan_enterprise"
  | "tier_not_eligible"
  | "tenant_missing"
  | "plan_resolution_failed";

export type WhatsAppEligibility = {
  allowed: boolean;
  reason: WhatsAppEligibilityReason;
  tier?: TenantPlanTier;
};

export async function evaluateWhatsAppEligibility(
  tenantId: string,
): Promise<WhatsAppEligibility> {
  if (!tenantId) {
    return { allowed: false, reason: "tenant_missing" };
  }

  let tier: TenantPlanTier;
  try {
    const profile = await getTenantPlanProfile(tenantId);
    tier = profile.tier;
  } catch (err) {
    logger.warn("evaluateWhatsAppEligibility: plan resolution failed", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { allowed: false, reason: "plan_resolution_failed" };
  }

  if (tier === WHATSAPP_BASE_TIER) {
    return { allowed: true, reason: "plan_enterprise", tier };
  }

  return { allowed: false, reason: "tier_not_eligible", tier };
}

export async function tenantPlanAllowsWhatsApp(
  tenantId: string,
): Promise<boolean> {
  return (await evaluateWhatsAppEligibility(tenantId)).allowed;
}

// Auto-enables whatsappEnabled on the tenant when a user registers their first
// phone number, but only if the tenant's plan actually supports WhatsApp.
// Fire-and-forget — caller must not await this if it would delay the response.
export async function maybeAutoEnableWhatsApp(tenantId: string): Promise<void> {
  if (!tenantId) return;

  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) return;
  if (tenantSnap.data()?.whatsappEnabled === true) return;

  if (await tenantPlanAllowsWhatsApp(tenantId)) {
    await tenantRef.update({ whatsappEnabled: true });
    clearTenantPlanCache(tenantId);
    logger.info("whatsapp auto-enabled for tenant", { tenantId });
  }
}
