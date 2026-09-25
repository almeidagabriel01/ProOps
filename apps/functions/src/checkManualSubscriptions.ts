import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { captureError } from "./lib/observability/error-logger";

/**
 * Batch que se divide sozinho: o Firestore aceita 500 escritas por batch, e
 * cada usuário expirado gera duas (user + espelho no tenant). Com mais de 250
 * expirações no mesmo dia o batch único falhava inteiro, e ninguém mudava de
 * status.
 */
export function createChunkedBatch(maxWrites = 400) {
  const batches: FirebaseFirestore.WriteBatch[] = [db.batch()];
  let writes = 0;
  const current = () => {
    if (writes >= maxWrites) {
      batches.push(db.batch());
      writes = 0;
    }
    writes += 1;
    return batches[batches.length - 1];
  };
  return {
    update(ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>) {
      current().update(ref, data);
    },
    set(
      ref: FirebaseFirestore.DocumentReference,
      data: FirebaseFirestore.DocumentData,
      options: FirebaseFirestore.SetOptions,
    ) {
      current().set(ref, data, options);
    },
    async commit() {
      for (const batch of batches) await batch.commit();
    },
  };
}

/** Resolve the tenant id from a user doc (tenantId, legacy companyId fallback). */
function mirrorTenantId(userData: FirebaseFirestore.DocumentData): string | null {
  const raw = userData?.["tenantId"] ?? userData?.["companyId"];
  const tid = typeof raw === "string" ? raw.trim() : "";
  return tid || null;
}

export const checkManualSubscriptions = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 24 hours",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    console.log("Starting manual subscription check...");
    const now = new Date();

    try {
      // 1. Check for Active -> Past Due
      // Find subscriptions that are manual, active, and expired
      const activeSnapshot = await db
        .collection("users")
        .where("isManualSubscription", "==", true)
        .where("subscriptionStatus", "==", "active")
        .where("currentPeriodEnd", "<", now.toISOString())
        .get();

      if (!activeSnapshot.empty) {
        const batch = createChunkedBatch();
        let count = 0;
        const nowIso = new Date().toISOString();

        activeSnapshot.docs.forEach((doc) => {
          // Double check to be safe (client-side filter if index issues)
          // But query should handle it.
          batch.update(doc.ref, {
            subscriptionStatus: "past_due",
            updatedAt: nowIso,
          });
          // Mirror to the tenant doc — the SuperAdmin dashboard treats the
          // tenant doc as authoritative, so a user-doc-only write would leave a
          // stale status on the card. Keep both sources in sync (same contract
          // the Stripe path already follows).
          const tenantId = mirrorTenantId(doc.data());
          if (tenantId) {
            batch.set(
              db.collection("tenants").doc(tenantId),
              { subscriptionStatus: "past_due", updatedAt: nowIso },
              { merge: true },
            );
          }
          count++;
        });

        await batch.commit();
        console.log(`Updated ${count} active subscriptions to past_due.`);
      } else {
        console.log("No active subscriptions found expring today.");
      }

      // 2. Check for Past Due -> Canceled (Grace Period: 7 days)
      const GRACE_PERIOD_DAYS = 7;
      const graceLimitDate = new Date();
      graceLimitDate.setDate(now.getDate() - GRACE_PERIOD_DAYS);

      const pastDueSnapshot = await db
        .collection("users")
        .where("isManualSubscription", "==", true)
        .where("subscriptionStatus", "==", "past_due")
        .where("currentPeriodEnd", "<", graceLimitDate.toISOString())
        .get();

      if (!pastDueSnapshot.empty) {
        const batch = createChunkedBatch();
        let count = 0;
        const nowIso = new Date().toISOString();

        pastDueSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            subscriptionStatus: "canceled",
            planId: "free", // Downgrade to free
            updatedAt: nowIso,
          });
          // Mirror status + plan to the tenant doc (dashboard authoritative
          // source). plan:free keeps the badge/derivation consistent; the
          // canceled status still wins over the free tier in display.
          const tenantId = mirrorTenantId(doc.data());
          if (tenantId) {
            batch.set(
              db.collection("tenants").doc(tenantId),
              { subscriptionStatus: "canceled", plan: "free", updatedAt: nowIso },
              { merge: true },
            );
          }
          count++;
        });

        await batch.commit();
        console.log(
          `Canceled ${count} past_due subscriptions (expired > 7 days).`
        );
      } else {
        console.log(
          "No past_due subscriptions found suitable for cancellation."
        );
      }
    } catch (error) {
      console.error("Error checking manual subscriptions:", error);
      void captureError(error, { source: "functions", route: "cron/checkManualSubscriptions", handled: false });
    }
  }
);
