import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./init";
import { getStripe } from "./stripe/stripeConfig";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { NotificationService } from "./api/services/notification.service";
import { logger } from "./lib/logger";

const PAGE_LIMIT = 200;

export interface ReconcileResult {
  processed: number;
  corrected: number;
  alerts: number;
  errors: number;
  dryRun: boolean;
}

/**
 * Core reconciliation logic shared by the cron and the manual debug endpoint.
 *
 * Iterates all addon documents that have a stripeSubscriptionId and compares
 * the Stripe subscription status against the Firestore record.
 *
 * Corrections applied automatically:
 *   - Stripe `canceled` + Firestore `active`  → update Firestore to `cancelled`
 *   - `cancel_at_period_end` divergence        → update Firestore to match Stripe
 *
 * Alerts sent to superadmins (NOT auto-corrected — may be a race with other crons):
 *   - Stripe `active` + Firestore `cancelled`  → could be a race condition
 *
 * @param dryRun - when true, logs what would be changed but does not write anything.
 */
export async function runAddonReconciliation(
  dryRun = false,
): Promise<ReconcileResult> {
  const stripe = getStripe();
  const result: ReconcileResult = {
    processed: 0,
    corrected: 0,
    alerts: 0,
    errors: 0,
    dryRun,
  };

  // Paginate through all addon docs that have a Stripe subscription attached.
  let lastDocId: string | undefined;

  while (true) {
    let q = db
      .collection("addons")
      .where("stripeSubscriptionId", "!=", null)
      .limit(PAGE_LIMIT);

    if (lastDocId) {
      const lastDoc = await db.collection("addons").doc(lastDocId).get();
      if (lastDoc.exists) {
        q = q.startAfter(lastDoc);
      }
    }

    const snap = await q.get();
    if (snap.empty) break;

    lastDocId = snap.docs[snap.docs.length - 1].id;

    for (const addonDoc of snap.docs) {
      result.processed++;
      const data = addonDoc.data() as Record<string, unknown>;
      const tenantId = String(data.tenantId || "").trim();
      const addonType = String(data.addonType || "").trim();
      const stripeSubscriptionId = String(data.stripeSubscriptionId || "").trim();
      const firestoreStatus = String(data.status || "").trim().toLowerCase();
      const firestoreCancelAtPeriodEnd = Boolean(data.cancelAtPeriodEnd);

      if (!stripeSubscriptionId || !tenantId) {
        continue;
      }

      let stripeSub: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>;
      try {
        stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      } catch (stripeErr) {
        const code = (stripeErr as { code?: string })?.code;
        const status = (stripeErr as { statusCode?: number })?.statusCode;
        if (code === "resource_missing" || status === 404) {
          // Subscription no longer exists in Stripe — mark as cancelled in Firestore.
          if (firestoreStatus !== "cancelled" && firestoreStatus !== "canceled") {
            if (!dryRun) {
              await addonDoc.ref.update({
                status: "cancelled",
                cancelAtPeriodEnd: false,
                updatedAt: new Date().toISOString(),
                reconcilerNote: "stripe_subscription_not_found",
              });
            }
            logger.warn("[reconcileAddons] Stripe subscription missing — marking cancelled", {
              tenantId,
              addonType,
              stripeSubscriptionId,
              dryRun,
            });
            result.corrected++;
          }
        } else {
          logger.error("[reconcileAddons] Failed to retrieve Stripe subscription", {
            tenantId,
            addonType,
            stripeSubscriptionId,
            error: stripeErr instanceof Error ? stripeErr.message : String(stripeErr),
          });
          result.errors++;
        }
        continue;
      }

      const stripeStatus = String(stripeSub.status || "").trim().toLowerCase();
      const stripeCancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end);
      const normalizedFirestoreStatus =
        firestoreStatus === "cancelled" ? "canceled" : firestoreStatus;

      // Case 1: Stripe is canceled but Firestore still shows active/past_due.
      if (
        stripeStatus === "canceled" &&
        normalizedFirestoreStatus !== "canceled"
      ) {
        if (!dryRun) {
          const nowIso = new Date().toISOString();
          await addonDoc.ref.update({
            status: "cancelled",
            cancelAtPeriodEnd: false,
            expiresAt: nowIso,
            updatedAt: nowIso,
            reconcilerNote: "stripe_status_canceled",
          });
        }
        logger.warn("[reconcileAddons] Corrected: Stripe canceled, Firestore was active", {
          tenantId,
          addonType,
          stripeSubscriptionId,
          firestoreStatus,
          dryRun,
        });
        result.corrected++;
        continue;
      }

      // Case 2: Stripe is active but Firestore shows cancelled — possible race with
      // scheduled-plan cron or a checkout that completed after a cancel. Do NOT
      // auto-correct; alert superadmins for manual review.
      if (
        (stripeStatus === "active" || stripeStatus === "trialing") &&
        (normalizedFirestoreStatus === "canceled")
      ) {
        logger.warn("[reconcileAddons] Alert: Stripe active but Firestore cancelled — needs manual review", {
          tenantId,
          addonType,
          stripeSubscriptionId,
          stripeStatus,
          firestoreStatus,
          dryRun,
        });
        result.alerts++;
        continue;
      }

      // Case 3: cancel_at_period_end divergence — Firestore should always match Stripe.
      if (
        (stripeStatus === "active" || stripeStatus === "trialing" || stripeStatus === "past_due") &&
        firestoreCancelAtPeriodEnd !== stripeCancelAtPeriodEnd
      ) {
        if (!dryRun) {
          const update: Record<string, unknown> = {
            cancelAtPeriodEnd: stripeCancelAtPeriodEnd,
            updatedAt: new Date().toISOString(),
            reconcilerNote: "cancel_at_period_end_drift",
          };
          if (!stripeCancelAtPeriodEnd) {
            update.cancelScheduledAt = null;
          }
          await addonDoc.ref.update(update);
        }
        logger.warn("[reconcileAddons] Corrected: cancel_at_period_end drift", {
          tenantId,
          addonType,
          stripeSubscriptionId,
          firestoreCancelAtPeriodEnd,
          stripeCancelAtPeriodEnd,
          dryRun,
        });
        result.corrected++;
      }
    }

    if (snap.docs.length < PAGE_LIMIT) break;
  }

  return result;
}

async function notifySuperAdmins(result: ReconcileResult): Promise<void> {
  try {
    const superAdminsSnap = await db
      .collection("users")
      .where("role", "in", ["superadmin", "SUPERADMIN"])
      .get();

    if (superAdminsSnap.empty) return;

    const title = "Reconciliação de Add-ons";
    const message =
      `Reconciliação concluída. Processados: ${result.processed}, ` +
      `corrigidos: ${result.corrected}, alertas: ${result.alerts}` +
      (result.errors > 0 ? `, erros: ${result.errors}` : "") +
      (result.dryRun ? " [dry run]" : "") +
      ".";

    await Promise.all(
      superAdminsSnap.docs.map(async (adminDoc) => {
        const tenantId = "system";
        const existingSnap = await db
          .collection("notifications")
          .where("tenantId", "==", tenantId)
          .where("userId", "==", adminDoc.id)
          .where("type", "==", "system")
          .get();

        const reconDocs = existingSnap.docs.filter((d) => {
          const t = (d.data() as { title?: string }).title;
          return t === title;
        });

        if (reconDocs.length === 0) {
          return NotificationService.createNotification({
            tenantId,
            userId: adminDoc.id,
            type: "system",
            title,
            message,
          });
        }

        reconDocs.sort((a, b) => {
          const aTs = new Date(String((a.data() as { createdAt?: string }).createdAt || 0)).getTime();
          const bTs = new Date(String((b.data() as { createdAt?: string }).createdAt || 0)).getTime();
          return bTs - aTs;
        });

        const [latest, ...old] = reconDocs;
        await latest.ref.update({
          message,
          createdAt: new Date().toISOString(),
          isRead: false,
          readAt: FieldValue.delete(),
        });

        if (old.length > 0) {
          await Promise.all(old.map((d) => d.ref.delete()));
        }

        return null;
      }),
    );
  } catch (err) {
    logger.error("[reconcileAddons] Failed to notify superadmins", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export const reconcileAddons = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "0 */6 * * *", // every 6 hours
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    logger.info("[reconcileAddons] Starting addon reconciliation...");

    const result = await runAddonReconciliation(false);

    logger.info("[reconcileAddons] Completed", result as unknown as Record<string, unknown>);

    if (result.corrected > 0 || result.alerts > 0 || result.errors > 0) {
      await notifySuperAdmins(result);
    }
  },
);
