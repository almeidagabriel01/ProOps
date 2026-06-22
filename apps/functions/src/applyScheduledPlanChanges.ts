import { onSchedule } from "firebase-functions/v2/scheduler";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { clearTenantPlanCache, normalizePlanTier } from "./lib/tenant-plan-policy";
import { tenantPlanAllowsWhatsApp } from "./lib/whatsapp-eligibility";

/**
 * Daily cron (03:00 BRT) that applies scheduled plan transitions whose
 * effective date has passed. Transitions are written to tenants/{id} as:
 *   scheduledPlan: TenantPlanTier
 *   scheduledPlanAt: Timestamp
 *   scheduledPlanReason: "downgrade" | "cancel_at_period_end"
 *
 * This function reads the tenant docs, applies the plan change, recomputes
 * whatsappEnabled, and clears the scheduled fields.
 *
 * Idempotent: re-running on the same tenant within the same day is safe —
 * once the scheduled fields are cleared the tenant is skipped on retries.
 */
export const applyScheduledPlanChanges = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "0 3 * * *", // 03:00 BRT daily
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    console.log("[applyScheduledPlanChanges] Starting scheduled plan transitions...");
    const now = Timestamp.now();
    const nowMs = now.toMillis();

    let processed = 0;
    let applied = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Query tenants with a scheduled plan whose effective date is in the past.
      // Firestore requires an index on (scheduledPlanAt ASC) for this query.
      const snap = await db
        .collection("tenants")
        .where("scheduledPlanAt", "<=", now)
        .limit(200)
        .get();

      if (snap.empty) {
        console.log("[applyScheduledPlanChanges] No pending plan transitions.");
        return;
      }

      for (const doc of snap.docs) {
        processed++;
        const tenantId = doc.id;
        const data = doc.data() as Record<string, unknown>;

        const scheduledTier = normalizePlanTier(data.scheduledPlan);
        const scheduledPlanAt = data.scheduledPlanAt as Timestamp | null | undefined;

        // Skip docs where the Timestamp condition passed but scheduledPlan is invalid.
        if (!scheduledTier || !scheduledPlanAt) {
          skipped++;
          console.warn(
            `[applyScheduledPlanChanges] Tenant ${tenantId} matched query but has invalid scheduledPlan/scheduledPlanAt — skipping`,
          );
          continue;
        }

        // Double-check in application code (belt-and-suspenders against index lag).
        if (scheduledPlanAt.toMillis() > nowMs) {
          skipped++;
          continue;
        }

        try {
          const tenantRef = db.collection("tenants").doc(tenantId);

          // Re-read inside a transaction to guard against a concurrent webhook
          // (e.g. subscription.updated) that may have already applied or changed
          // the scheduled transition since the query snapshot was taken.
          let transitionApplied = false;
          await db.runTransaction(async (tx) => {
            const fresh = await tx.get(tenantRef);
            if (!fresh.exists) return;
            const freshData = fresh.data() as Record<string, unknown>;
            const freshTier = normalizePlanTier(freshData.scheduledPlan);
            const freshAt = freshData.scheduledPlanAt as Timestamp | null | undefined;
            // Abort if the scheduled transition was modified or cleared by a concurrent write.
            if (
              !freshTier ||
              !freshAt ||
              freshTier !== scheduledTier ||
              freshAt.toMillis() !== scheduledPlanAt.toMillis()
            ) {
              return; // Concurrent write took precedence — skip.
            }
            if (freshAt.toMillis() > nowMs) return; // Not yet due (clock skew).
            tx.set(
              tenantRef,
              {
                plan: scheduledTier,
                scheduledPlan: null,
                scheduledPlanAt: null,
                scheduledPlanReason: null,
                updatedAt: new Date().toISOString(),
                // Phase 19: write subscription.* counterparts inside SAME transaction (Pitfall 5 — no nested transactions)
                "subscription.plan": scheduledTier,
                "subscription.scheduledPlan": null,
                "subscription.scheduledPlanAt": null,
                "subscription.scheduledPlanReason": null,
                "subscription.syncedAt": new Date().toISOString(),
              },
              { merge: true },
            );
            transitionApplied = true;
          });

          if (!transitionApplied) {
            skipped++;
            continue;
          }

          // Recompute WhatsApp eligibility against the new tier.
          clearTenantPlanCache(tenantId);
          const allowsWhatsApp = await tenantPlanAllowsWhatsApp(tenantId);
          await tenantRef.update({ whatsappEnabled: allowsWhatsApp });

          applied++;
          console.log(
            `[applyScheduledPlanChanges] Applied plan transition for tenant ${tenantId}: → ${scheduledTier}, whatsappEnabled=${allowsWhatsApp}`,
          );
        } catch (tenantErr) {
          errors++;
          console.error(
            `[applyScheduledPlanChanges] Failed to apply transition for tenant ${tenantId}`,
            tenantErr,
          );
        }
      }
    } catch (err) {
      console.error("[applyScheduledPlanChanges] Fatal error querying tenants", err);
      errors++;
    }

    console.log(
      `[applyScheduledPlanChanges] Done. processed=${processed} applied=${applied} skipped=${skipped} errors=${errors}`,
    );
  },
);
