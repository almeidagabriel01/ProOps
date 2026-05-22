import { Request, Response } from "express";
import { getStripe } from "../../stripe/stripeConfig";
import { db } from "../../init";
import * as admin from "firebase-admin";
import { logger } from "../../lib/logger";
import { FieldValue } from "firebase-admin/firestore";
import { detectPriceDrift } from "../../billing/price-drift";
import { sendEmail } from "../../services/email/send-email";
import { renderPriceChangeEmail } from "../../services/email/templates/price-change";
import type { NotificationType } from "../services/notification.service";
import { clearTenantPlanCache } from "../../lib/tenant-plan-policy";

const WHATSAPP_OVERAGE_EVENT_NAME = "whatsapp_messages";

function getPreviousMonthKey(baseDate = new Date()): string {
  const d = new Date(
    Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const reportWhatsappOverageManual = async (
  req: Request,
  res: Response,
) => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const body = req.body || {};
    const monthFromQuery = req.query.month;
    const month = String(
      body.month || monthFromQuery || getPreviousMonthKey(),
    ).trim();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res
        .status(400)
        .json({ message: "Invalid month format. Expected YYYY-MM." });
    }

    const stripe = getStripe();
    const tenantsSnap = await db
      .collection("tenants")
      .where("whatsappEnabled", "==", true)
      .where("whatsappAllowOverage", "==", true)
      .get();

    let processed = 0;
    let charged = 0;
    let skipped = 0;
    const errors: Array<{ tenantId: string; message: string }> = [];

    for (const tenantDoc of tenantsSnap.docs) {
      processed += 1;
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data() as {
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
      };

      try {
        const usageRef = db
          .collection("whatsappUsage")
          .doc(tenantId)
          .collection("months")
          .doc(month);
        const usageSnap = await usageRef.get();

        if (!usageSnap.exists) {
          skipped += 1;
          continue;
        }

        const usageData = usageSnap.data() as
          | { overageMessages?: number; stripeReported?: boolean }
          | undefined;
        const overageMessages = Number(usageData?.overageMessages || 0);
        const stripeReported = usageData?.stripeReported === true;

        if (overageMessages <= 0 || stripeReported) {
          skipped += 1;
          continue;
        }

        const stripeCustomerId = String(
          tenantData?.stripeCustomerId || "",
        ).trim();
        if (!stripeCustomerId) {
          errors.push({
            tenantId,
            message: "Missing tenant.stripeCustomerId",
          });
          continue;
        }

        const idempotencyKey = `${tenantId}:${month}:whatsapp_overage`;
        const event = await stripe.billing.meterEvents.create({
          event_name: WHATSAPP_OVERAGE_EVENT_NAME,
          identifier: idempotencyKey,
          payload: {
            value: String(overageMessages),
            stripe_customer_id: stripeCustomerId,
          },
        });

        await usageRef.set(
          {
            stripeReported: true,
            stripeEventId: event.identifier,
            stripeReportedAt: admin.firestore.FieldValue.serverTimestamp(),
            stripeReportIdempotencyKey: idempotencyKey,
            stripeSubscriptionId: tenantData?.stripeSubscriptionId || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        charged += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ tenantId, message });
      }
    }

    return res.json({
      month,
      processed,
      charged,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("[Cron api] whatsapp overage report failed", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const migrateWhatsAppAddons = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const stripe = getStripe();

    const addonsSnap = await db
      .collection("addons")
      .where("addonType", "==", "whatsapp_addon")
      .where("status", "==", "active")
      .get();

    const results = await Promise.allSettled(
      addonsSnap.docs.map(
        async (doc): Promise<{ id: string; skipped?: boolean; cancelled?: boolean }> => {
          const data = doc.data() as {
            stripeSubscriptionId?: string;
            tenantId?: string;
          };
          const stripeSubscriptionId = String(
            data.stripeSubscriptionId || "",
          ).trim();

          if (!stripeSubscriptionId || (doc.data() as Record<string, unknown>).cancelAtPeriodEnd) {
            return { id: doc.id, skipped: true };
          }

          await stripe.subscriptions.update(stripeSubscriptionId, {
            cancel_at_period_end: true,
          });

          await doc.ref.update({
            cancelAtPeriodEnd: true,
            cancelScheduledAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          return { id: doc.id, cancelled: true };
        },
      ),
    );

    let cancelled = 0;
    let skipped = 0;
    const errors: Array<{ id: string; message: string }> = [];

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value.cancelled) cancelled++;
        else skipped++;
      } else {
        errors.push({
          id: "unknown",
          message:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
      }
    }

    console.log(
      `[migrateWhatsAppAddons] processed=${addonsSnap.size} cancelled=${cancelled} skipped=${skipped} errors=${errors.length}`,
    );

    return res.json({
      processed: addonsSnap.size,
      cancelled,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("[Cron api] migrate-whatsapp-addons failed", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const PRICE_CHANGE_NOTIFY_DAYS = 30;
const PRICE_CHANGE_MIGRATE_DAYS = 1;
const WHATSAPP_OVERAGE_PRICE_ID_INTERNAL = "price_1T20T7GrkF9UfsqcEtdBX9fY";

function daysUntilInternal(isoDate: string): number {
  const ms = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function formatBRLInternal(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function formatDateBRInternal(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function upsertPriceChangeNotificationInternal(data: {
  tenantId: string;
  notificationId: string;
  title: string;
  message: string;
}): Promise<void> {
  const type: NotificationType = "price_change";
  const notificationRef = db.collection("notifications").doc(data.notificationId);
  await notificationRef.set(
    {
      tenantId: data.tenantId,
      type,
      title: data.title,
      message: data.message,
      isRead: false,
      readAt: FieldValue.delete(),
      createdAt: new Date().toISOString(),
    },
    { merge: true },
  );
}

export const checkPriceChangesManual = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const stripe = getStripe();
    const APP_URL = process.env.APP_URL ?? "https://app.proops.com.br";

    const tenantsSnap = await db
      .collection("tenants")
      .where("subscriptionStatus", "in", ["active", "trialing"])
      .limit(200)
      .get();

    let processed = 0;
    let notified = 0;
    let migrated = 0;
    let skipped = 0;
    const errors: Array<{ tenantId: string; message: string }> = [];

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data() as Record<string, unknown>;

      try {
        if (tenantData.isManualSubscription) { skipped++; continue; }

        const stripeSubscriptionId = String(tenantData.stripeSubscriptionId ?? "").trim();
        if (!stripeSubscriptionId) { skipped++; continue; }

        const drift = detectPriceDrift({
          stripePriceId: tenantData.stripePriceId as string | undefined,
          priceId: tenantData.priceId as string | undefined,
          billingInterval: tenantData.billingInterval as string | undefined,
          isManualSubscription: Boolean(tenantData.isManualSubscription),
          stripeSubscriptionId,
        });

        if (!drift.hasDrift) { skipped++; continue; }

        const currentPeriodEnd = String(tenantData.currentPeriodEnd ?? "").trim();
        if (!currentPeriodEnd) { skipped++; continue; }

        const days = daysUntilInternal(currentPeriodEnd);

        if (days <= PRICE_CHANGE_MIGRATE_DAYS) {
          const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
            expand: ["items"],
          });

          if (subscription.cancel_at_period_end) {
            skipped++; processed++; continue;
          }

          const planItem = subscription.items.data.find(
            (item) => item.price.id !== WHATSAPP_OVERAGE_PRICE_ID_INTERNAL,
          );

          if (!planItem) {
            skipped++; processed++; continue;
          }

          await stripe.subscriptions.update(stripeSubscriptionId, {
            items: [{ id: planItem.id, price: drift.expectedPriceId! }],
            proration_behavior: "none",
          });

          await tenantDoc.ref.update({
            priceChangeNotifiedFor: null,
            priceChangeNotifiedAt: null,
          });

          logger.info("[checkPriceChanges manual] migrated subscription", {
            tenantId,
            fromPriceId: drift.currentPriceId,
            toPriceId: drift.expectedPriceId,
          });
          migrated++;
          processed++;
          continue;
        }

        if (days <= PRICE_CHANGE_NOTIFY_DAYS) {
          const alreadyNotifiedFor = String(tenantData.priceChangeNotifiedFor ?? "").trim();
          if (alreadyNotifiedFor === drift.expectedPriceId) {
            skipped++; processed++; continue;
          }

          let newUnitAmount = 0;
          try {
            const newPrice = await stripe.prices.retrieve(drift.expectedPriceId!);
            newUnitAmount = newPrice.unit_amount ?? 0;
          } catch (priceErr) {
            logger.warn("[checkPriceChanges manual] failed to retrieve new price", {
              priceId: drift.expectedPriceId,
              error: String(priceErr),
            });
          }

          const currentUnitAmount = Number(
            (tenantData.unitAmount as number | undefined) ?? 0,
          );
          const tierStr = String(drift.tier ?? "");
          const planName = `Plano ${tierStr.charAt(0).toUpperCase()}${tierStr.slice(1)}`;
          const tenantName = String(tenantData.companyName ?? tenantData.name ?? tenantId).trim();
          const notificationId = `price_change_${tenantId}_${drift.expectedPriceId}_${currentPeriodEnd}`;

          try {
            await upsertPriceChangeNotificationInternal({
              tenantId,
              notificationId,
              title: "Atualização de preço do plano",
              message: `Seu ${planName} será atualizado de ${formatBRLInternal(currentUnitAmount)} para ${formatBRLInternal(newUnitAmount)}/mês a partir de ${formatDateBRInternal(currentPeriodEnd)}.`,
            });
          } catch (notifErr) {
            logger.warn("[checkPriceChanges manual] failed to upsert notification", {
              tenantId,
              error: String(notifErr),
            });
          }

          let ownerEmail = "";
          try {
            const usersSnap = await db
              .collection("users")
              .where("tenantId", "==", tenantId)
              .where("role", "==", "master")
              .limit(1)
              .get();
            if (!usersSnap.empty) {
              ownerEmail = String(usersSnap.docs[0].data().email ?? "").trim();
            }
          } catch (emailErr) {
            logger.warn("[checkPriceChanges manual] failed to get owner email", {
              tenantId,
              error: String(emailErr),
            });
          }

          if (ownerEmail) {
            try {
              const html = renderPriceChangeEmail({
                tenantName,
                planName,
                oldPriceFormatted: formatBRLInternal(currentUnitAmount),
                newPriceFormatted: formatBRLInternal(newUnitAmount),
                renewalDateFormatted: formatDateBRInternal(currentPeriodEnd),
                cancelUrl: `${APP_URL}/profile?tab=subscription`,
              });
              await sendEmail({
                to: ownerEmail,
                subject: `Atualização de preço do ${planName} — ProOps`,
                html,
                tenantId,
                type: "price_change",
              });
            } catch (emailSendErr) {
              logger.warn("[checkPriceChanges manual] failed to send email", {
                tenantId,
                error: String(emailSendErr),
              });
            }
          }

          await tenantDoc.ref.update({
            priceChangeNotifiedFor: drift.expectedPriceId,
            priceChangeNotifiedAt: new Date().toISOString(),
          });

          logger.info("[checkPriceChanges manual] notified tenant", {
            tenantId,
            days,
            fromPriceId: drift.currentPriceId,
            toPriceId: drift.expectedPriceId,
          });
          notified++;
        }

        processed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ tenantId, message });
      }
    }

    return res.json({ processed, notified, migrated, skipped, errors });
  } catch (error) {
    logger.error("[Cron api] check-price-changes failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const reconcileAddonsManual = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const dryRun =
      String(req.query.dryRun || req.body?.dryRun || "false").trim().toLowerCase() === "true";

    const { runAddonReconciliation } = await import("../../reconcileAddons");
    const result = await runAddonReconciliation(dryRun);

    logger.info("[reconcileAddons manual] completed", result as unknown as Record<string, unknown>);

    return res.json(result);
  } catch (error) {
    logger.error("[reconcileAddons manual] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const processPayoutRetriesManual = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const now = new Date().toISOString();
    const snap = await db
      .collection("payout_attempts")
      .where("status", "==", "pending_balance")
      .where("nextRetryAt", "<=", now)
      .limit(100)
      .get();

    logger.info("[processPayoutRetries manual] processing attempts", { count: snap.size });

    const { executeTransfer } = await import("../../api/services/payout-transfer.service");

    let processed = 0;
    const errors: Array<{ attemptId: string; message: string }> = [];

    for (const doc of snap.docs) {
      try {
        await executeTransfer(doc.id);
        processed++;
      } catch (err) {
        errors.push({
          attemptId: doc.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("[processPayoutRetries manual] done", { processed, errors: errors.length });

    return res.json({ processed, errors });
  } catch (error) {
    logger.error("[processPayoutRetries manual] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Debug-only endpoint to invalidate the in-memory tenant-plan LRU cache.
 *
 * Used by E2E test fixtures (restoreTenantState) to make plan changes
 * visible to the backend immediately, replacing the 6s sleep-based
 * waitForCacheExpiry workaround.
 *
 * Body: { tenantId?: string } — omit tenantId to clear the entire cache.
 * Header: x-cron-secret must match CRON_SECRET.
 */
export const markOverdueTransactionsManual = async (
  req: Request,
  res: Response,
) => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const { runMarkOverdueTransactions } = await import(
      "../../markOverdueTransactions"
    );
    const result = await runMarkOverdueTransactions();
    logger.info("[markOverdueTransactions manual] completed", { ...result });
    return res.json(result);
  } catch (error) {
    logger.error("[markOverdueTransactions manual] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const cleanupBillingRedundantFieldsManual = async (
  req: Request,
  res: Response,
) => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }
    const { cleanupBillingRedundantFields } = await import(
      "../../scripts/cleanup-billing-redundant-fields"
    );
    const result = await cleanupBillingRedundantFields();
    logger.info("[cleanupBillingRedundantFields manual] completed", {
      scanned: result.scanned,
      updated: result.updated,
      batches: result.batches,
      inconsistentFreePayingCount: result.inconsistentFreePaying.length,
    });
    return res.json(result);
  } catch (error) {
    logger.error("[cleanupBillingRedundantFields manual] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const cleanupTrialFieldsManual = async (
  req: Request,
  res: Response,
) => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const { cleanupTrialFields } = await import(
      "../../scripts/cleanup-trial-fields"
    );
    const result = await cleanupTrialFields();
    logger.info("[cleanupTrialFields manual] completed", { ...result });
    return res.json(result);
  } catch (error) {
    logger.error("[cleanupTrialFields manual] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const invalidateTenantPlanCacheManual = async (
  req: Request,
  res: Response,
) => {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers["x-cron-secret"];
    if (!expectedSecret || headerSecret !== expectedSecret) {
      return res.status(401).send("Unauthorized");
    }

    const body = (req.body || {}) as { tenantId?: string };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";

    if (tenantId) {
      clearTenantPlanCache(tenantId);
      logger.info("[invalidateTenantPlanCache manual] cleared one", { tenantId });
      return res.json({ cleared: tenantId });
    }

    clearTenantPlanCache();
    logger.info("[invalidateTenantPlanCache manual] cleared all");
    return res.json({ cleared: "all" });
  } catch (error) {
    logger.error("[invalidateTenantPlanCache manual] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Internal Server Error" });
  }
};
