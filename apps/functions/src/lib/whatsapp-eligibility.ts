import { db } from "../init";
import { logger } from "./logger";

const WHATSAPP_ENABLED_TIERS = new Set(["pro", "enterprise"]);

export async function tenantPlanAllowsWhatsApp(
  tenantId: string,
): Promise<boolean> {
  if (!tenantId) return false;

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) return false;

  const plan = String(tenantSnap.data()?.plan || "").toLowerCase();
  if (WHATSAPP_ENABLED_TIERS.has(plan)) return true;

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
