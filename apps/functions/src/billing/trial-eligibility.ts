import { db } from "../init";

// 7-day paid trial: the user completes the normal checkout (card collected) but
// is not charged until the trial ends. One trial per account is enforced via
// trialUsedAt (authoritative, written by the webhook when the subscription
// actually starts trialing) plus a transient trialReservedAt lock (below, to
// cover the checkout window and prevent concurrent double-reservations).
export const PRO_TRIAL_DAYS = 7;
// Trial reservation expires after this many minutes if checkout was abandoned.
export const TRIAL_RESERVATION_TTL_MINUTES = 30;

/**
 * Atomically reserves the trial slot for a tenant using a Firestore transaction.
 * Prevents race conditions where two concurrent requests could both pass an
 * eligibility check before either writes trialUsedAt (TOCTOU vulnerability).
 *
 * Returns true if the slot was successfully reserved, false if the trial was
 * already used, the tenant already has a subscription, or an unexpired
 * reservation is already in place.
 */
export async function reserveTrialSlot(tenantId: string): Promise<boolean> {
  const tenantRef = db.collection("tenants").doc(tenantId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(tenantRef);
    if (!snap.exists) return false;

    const data = snap.data() as Record<string, unknown> | undefined;

    // Already used a trial — one trial per account.
    if (data?.trialUsedAt) return false;

    // Already has an active subscription — not eligible.
    if (data?.stripeSubscriptionId && String(data.stripeSubscriptionId).trim()) {
      return false;
    }

    // Check for a pending reservation that hasn't expired.
    if (data?.trialReservedAt) {
      const reservedAt = new Date(String(data.trialReservedAt)).getTime();
      const ttlMs = TRIAL_RESERVATION_TTL_MINUTES * 60 * 1000;
      if (Date.now() - reservedAt < ttlMs) {
        // Active unexpired reservation — could be a race or abandoned checkout.
        return false;
      }
      // Reservation has expired — allow re-reservation.
    }

    tx.set(
      tenantRef,
      { trialReservedAt: new Date().toISOString() },
      { merge: true },
    );
    return true;
  });
}

/**
 * Checks if the email (across all tenants/users) has already consumed a trial.
 * Abuse via multiple accounts with *different* emails is still possible, but
 * this blocks the simpler same-email multi-account pattern.
 */
export async function hasEmailUsedTrial(email: string): Promise<boolean> {
  if (!email || !email.includes("@")) return false;
  const snap = await db
    .collection("users")
    .where("email", "==", email.toLowerCase().trim())
    .limit(5)
    .get();

  for (const doc of snap.docs) {
    const userData = doc.data() as Record<string, unknown>;
    const userTenantId = String(userData.tenantId || userData.companyId || "").trim();
    if (!userTenantId) continue;
    const tenantSnap = await db.collection("tenants").doc(userTenantId).get();
    if (tenantSnap.exists) {
      const tenantData = tenantSnap.data() as Record<string, unknown> | undefined;
      if (tenantData?.trialUsedAt) return true;
    }
  }
  return false;
}

/**
 * Releases a previously-reserved (but unconsumed) trial slot — used when a
 * same-email abuse check fails after the slot was reserved.
 */
export async function releaseTrialReservation(tenantId: string): Promise<void> {
  await db
    .collection("tenants")
    .doc(tenantId)
    .set({ trialReservedAt: null }, { merge: true });
}
