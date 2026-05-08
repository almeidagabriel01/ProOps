import { auth, db } from "../init";
import { logger } from "./logger";

export interface BillingClaimsUpdate {
  subscriptionStatus: string;
  subscriptionPlan?: string;
  subscriptionUpdatedAt?: string;
}

// past_due intentionally excluded: user still needs a valid session to access
// the billing portal and fix payment. Revoke only on hard terminal statuses.
const REVOKE_TOKEN_STATUSES = new Set(["canceled", "unpaid", "inactive"]);

/**
 * Propagates billing status changes into Firebase Auth custom claims for every
 * user in the tenant, and revokes refresh tokens for terminal statuses.
 *
 * Uses Promise.allSettled so a failure on one user never aborts the rest.
 * The webhook will reconcile any missed users on the next billing event.
 *
 * CRITICAL: always spreads existing claims before writing — setCustomUserClaims
 * REPLACES the entire claims object, so omitting existing claims (tenantId,
 * role, masterId) would revoke access for all affected users.
 */
export async function applyBillingClaimsToTenantUsers(
  tenantId: string,
  claimsUpdate: BillingClaimsUpdate,
): Promise<void> {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) return;

  const shouldRevoke = REVOKE_TOKEN_STATUSES.has(
    String(claimsUpdate.subscriptionStatus || "").toLowerCase(),
  );

  const billingClaims = {
    subscriptionStatus: claimsUpdate.subscriptionStatus,
    ...(claimsUpdate.subscriptionPlan !== undefined && {
      subscriptionPlan: claimsUpdate.subscriptionPlan,
    }),
    subscriptionUpdatedAt:
      claimsUpdate.subscriptionUpdatedAt ?? new Date().toISOString(),
  };

  const usersSnap = await db
    .collection("users")
    .where("tenantId", "==", normalizedTenantId)
    .limit(50)
    .get();

  if (usersSnap.empty) return;

  const results = await Promise.allSettled(
    usersSnap.docs.map(async (docSnap) => {
      const uid = docSnap.id;
      const userRecord = await auth.getUser(uid);
      const existing = userRecord.customClaims ?? {};
      // Spread existing first — setCustomUserClaims replaces, does not merge.
      await auth.setCustomUserClaims(uid, { ...existing, ...billingClaims });
      if (shouldRevoke) {
        await auth.revokeRefreshTokens(uid);
      }
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    logger.warn("billing_claims: partial_failure", {
      tenantId: normalizedTenantId,
      total: results.length,
      failed: failed.length,
    });
  }
}
