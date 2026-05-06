import { db } from "../init";
import { logger } from "./logger";
import { getTenantPlanProfile } from "./tenant-plan-policy";

const WHATSAPP_ENABLED_TIERS = new Set<string>(["pro", "enterprise"]);

export async function tenantPlanAllowsWhatsApp(
  tenantId: string,
): Promise<boolean> {
  if (!tenantId) return false;

  try {
    const profile = await getTenantPlanProfile(tenantId);
    if (WHATSAPP_ENABLED_TIERS.has(profile.tier)) return true;
  } catch (err) {
    logger.warn("tenantPlanAllowsWhatsApp: profile resolution failed", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const addonDoc = await db
    .collection("addons")
    .doc(`${tenantId}_whatsapp_addon`)
    .get();
  return addonDoc.exists && addonDoc.data()?.status === "active";
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
    logger.info("whatsapp auto-enabled for tenant", { tenantId });
  }
}
