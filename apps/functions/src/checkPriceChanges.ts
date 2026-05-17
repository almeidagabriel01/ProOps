import { onSchedule } from "firebase-functions/v2/scheduler";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { logger } from "./lib/logger";
import { getStripe } from "./stripe/stripeConfig";
import { detectPriceDrift } from "./billing/price-drift";
import { sendEmail } from "./services/email/send-email";
import { renderPriceChangeEmail } from "./services/email/templates/price-change";
import type { NotificationType } from "./api/services/notification.service";

const PRICE_CHANGE_NOTIFY_DAYS = 30;
const PRICE_CHANGE_MIGRATE_DAYS = 1;
const QUERY_LIMIT = 200;
const WHATSAPP_OVERAGE_PRICE_ID = "price_1T20T7GrkF9UfsqcEtdBX9fY";

function daysUntil(isoDate: string): number {
  const ms = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function formatBRL(centavos: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function formatDateBR(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

async function upsertPriceChangeNotification(data: {
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

export const checkPriceChanges = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "0 4 * * *",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    logger.info("[checkPriceChanges] starting");

    let processed = 0;
    let notified = 0;
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    const tenantsSnap = await db
      .collection("tenants")
      .where("subscriptionStatus", "in", ["active", "trialing"])
      .limit(QUERY_LIMIT)
      .get();

    const stripe = getStripe();
    const APP_URL = process.env.APP_URL ?? "https://app.proops.com.br";

    for (const tenantDoc of tenantsSnap.docs) {
      const tenantId = tenantDoc.id;
      const tenantData = tenantDoc.data() as Record<string, unknown>;

      try {
        if (tenantData.isManualSubscription) {
          skipped++;
          continue;
        }

        const stripeSubscriptionId = String(
          tenantData.stripeSubscriptionId ?? "",
        ).trim();
        if (!stripeSubscriptionId) {
          skipped++;
          continue;
        }

        const drift = detectPriceDrift({
          stripePriceId: tenantData.stripePriceId as string | undefined,
          priceId: tenantData.priceId as string | undefined,
          billingInterval: tenantData.billingInterval as string | undefined,
          isManualSubscription: Boolean(tenantData.isManualSubscription),
          stripeSubscriptionId,
        });

        if (!drift.hasDrift) {
          skipped++;
          continue;
        }

        const currentPeriodEnd = String(
          tenantData.currentPeriodEnd ?? "",
        ).trim();
        if (!currentPeriodEnd) {
          skipped++;
          continue;
        }

        const days = daysUntil(currentPeriodEnd);

        // ── D-1: Auto-migrate ────────────────────────────────────────────
        if (days <= PRICE_CHANGE_MIGRATE_DAYS) {
          try {
            const subscription = await stripe.subscriptions.retrieve(
              stripeSubscriptionId,
              { expand: ["items"] },
            );

            if (subscription.cancel_at_period_end) {
              logger.info(
                "[checkPriceChanges] skipping migration — cancel_at_period_end=true",
                { tenantId },
              );
              skipped++;
              processed++;
              continue;
            }

            const planItem = subscription.items.data.find(
              (item) => item.price.id !== WHATSAPP_OVERAGE_PRICE_ID,
            );

            if (!planItem) {
              logger.warn(
                "[checkPriceChanges] no plan item found for migration",
                { tenantId },
              );
              skipped++;
              processed++;
              continue;
            }

            await stripe.subscriptions.update(stripeSubscriptionId, {
              items: [{ id: planItem.id, price: drift.expectedPriceId! }],
              proration_behavior: "none",
            });

            await tenantDoc.ref.update({
              priceChangeNotifiedFor: null,
              priceChangeNotifiedAt: null,
            });

            logger.info("[checkPriceChanges] migrated subscription", {
              tenantId,
              fromPriceId: drift.currentPriceId,
              toPriceId: drift.expectedPriceId,
            });
            migrated++;
          } catch (migrateErr) {
            logger.error("[checkPriceChanges] migration failed", {
              tenantId,
              error:
                migrateErr instanceof Error
                  ? migrateErr.message
                  : String(migrateErr),
            });
            errors++;
          }
          processed++;
          continue;
        }

        // ── D-30: Notify ─────────────────────────────────────────────────
        if (days <= PRICE_CHANGE_NOTIFY_DAYS) {
          // Idempotency: skip if already notified for this expectedPriceId
          const alreadyNotifiedFor = String(
            tenantData.priceChangeNotifiedFor ?? "",
          ).trim();
          if (alreadyNotifiedFor === drift.expectedPriceId) {
            skipped++;
            processed++;
            continue;
          }

          let newUnitAmount = 0;
          try {
            const newPrice = await stripe.prices.retrieve(
              drift.expectedPriceId!,
            );
            newUnitAmount = newPrice.unit_amount ?? 0;
          } catch (priceErr) {
            logger.warn("[checkPriceChanges] failed to retrieve new price", {
              priceId: drift.expectedPriceId,
              error: String(priceErr),
            });
          }

          const currentUnitAmount = Number(
            (tenantData.unitAmount as number | undefined) ?? 0,
          );

          const tierStr = String(drift.tier ?? "");
          const planName = `Plano ${tierStr.charAt(0).toUpperCase()}${tierStr.slice(1)}`;
          const tenantName = String(
            tenantData.companyName ?? tenantData.name ?? tenantId,
          ).trim();

          // Deterministic notification ID (idempotent upsert)
          const notificationId = `price_change_${tenantId}_${drift.expectedPriceId}_${currentPeriodEnd}`;

          try {
            await upsertPriceChangeNotification({
              tenantId,
              notificationId,
              title: "Atualização de preço do plano",
              message: `Seu ${planName} será atualizado de ${formatBRL(currentUnitAmount)} para ${formatBRL(newUnitAmount)}/mês a partir de ${formatDateBR(currentPeriodEnd)}.`,
            });
          } catch (notifErr) {
            logger.warn(
              "[checkPriceChanges] failed to upsert in-app notification",
              {
                tenantId,
                error: String(notifErr),
              },
            );
          }

          // Get the master user's email (non-fatal)
          let ownerEmail = "";
          try {
            const usersSnap = await db
              .collection("users")
              .where("tenantId", "==", tenantId)
              .where("role", "==", "master")
              .limit(1)
              .get();
            if (!usersSnap.empty) {
              ownerEmail = String(
                usersSnap.docs[0].data().email ?? "",
              ).trim();
            }
          } catch (emailErr) {
            logger.warn("[checkPriceChanges] failed to get owner email", {
              tenantId,
              error: String(emailErr),
            });
          }

          if (ownerEmail) {
            try {
              const html = renderPriceChangeEmail({
                tenantName,
                planName,
                oldPriceFormatted: formatBRL(currentUnitAmount),
                newPriceFormatted: formatBRL(newUnitAmount),
                renewalDateFormatted: formatDateBR(currentPeriodEnd),
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
              logger.warn("[checkPriceChanges] failed to send email", {
                tenantId,
                error: String(emailSendErr),
              });
            }
          }

          // Mark as notified for idempotency
          await tenantDoc.ref.update({
            priceChangeNotifiedFor: drift.expectedPriceId,
            priceChangeNotifiedAt: new Date().toISOString(),
          });

          logger.info("[checkPriceChanges] notified tenant", {
            tenantId,
            days,
            fromPriceId: drift.currentPriceId,
            toPriceId: drift.expectedPriceId,
          });
          notified++;
        }

        processed++;
      } catch (err) {
        logger.error("[checkPriceChanges] error processing tenant", {
          tenantId,
          error: err instanceof Error ? err.message : String(err),
        });
        errors++;
      }
    }

    logger.info("[checkPriceChanges] complete", {
      processed,
      notified,
      migrated,
      skipped,
      errors,
    });
  },
);
