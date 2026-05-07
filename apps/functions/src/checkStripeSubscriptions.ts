import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { NotificationService } from "./api/services/notification.service";
import { enqueueTenantSync } from "./billing";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "./lib/logger";

/**
 * Cloud Function agendada diariamente para verificar o status das assinaturas
 * Stripe e sincronizar com o Firestore. Itera tenants (não users) para cobrir
 * todos os tenants ativos, mesmo com user-docs desincronizados.
 */
export const checkStripeSubscriptions = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "0 3 * * *", // Diariamente às 03:00 BRT
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    logger.info("Starting daily Stripe subscription check...");

    let totalSynced = 0;
    let totalFailed = 0;

    const tenantsSnap = await db
      .collection("tenants")
      .where("subscriptionStatus", "!=", "free")
      .get();

    logger.info(`[checkStripeSubscriptions] Found ${tenantsSnap.docs.length} tenants to sync`);

    await Promise.allSettled(
      tenantsSnap.docs.map(async (doc) => {
        try {
          await enqueueTenantSync(doc.id, "cron");
          totalSynced++;
        } catch (err) {
          logger.error(`[checkStripeSubscriptions] Failed to sync tenant ${doc.id}`, {
            tenantId: doc.id,
            error: err instanceof Error ? err.message : String(err),
          });
          totalFailed++;
        }
      })
    );

    logger.info(`Sync complete. Synced: ${totalSynced}, Failed: ${totalFailed}`);

    // Notify superadmins with summary
    try {
      const superAdminsSnap = await db
        .collection("users")
        .where("role", "in", ["superadmin", "SUPERADMIN"])
        .get();

      if (superAdminsSnap.empty) {
        logger.info("No superadmins found to notify.");
        return;
      }

      const title = "Sincronização de Assinaturas";
      const message = `Sincronização diária concluída. Sincronizados: ${totalSynced}${totalFailed > 0 ? `, falhas: ${totalFailed}` : ""}.`;

      const notificationPromises = superAdminsSnap.docs.map(async (adminDoc) => {
        const tenantId = "system";

        const existingSnap = await db
          .collection("notifications")
          .where("tenantId", "==", tenantId)
          .where("userId", "==", adminDoc.id)
          .where("type", "==", "system")
          .get();

        const stripeSyncDocs = existingSnap.docs.filter((doc) => {
          const data = doc.data() as { title?: string };
          return data.title === title;
        });

        if (stripeSyncDocs.length === 0) {
          return NotificationService.createNotification({
            tenantId,
            userId: adminDoc.id,
            type: "system",
            title,
            message,
          });
        }

        stripeSyncDocs.sort((a, b) => {
          const aTs = new Date(String((a.data() as { createdAt?: string }).createdAt || 0)).getTime();
          const bTs = new Date(String((b.data() as { createdAt?: string }).createdAt || 0)).getTime();
          return bTs - aTs;
        });

        const [latestDoc, ...oldDocs] = stripeSyncDocs;

        await latestDoc.ref.update({
          message,
          createdAt: new Date().toISOString(),
          isRead: false,
          readAt: FieldValue.delete(),
        });

        if (oldDocs.length > 0) {
          await Promise.all(oldDocs.map((doc) => doc.ref.delete()));
        }

        return null;
      });

      await Promise.all(notificationPromises);
      logger.info(`Notified ${superAdminsSnap.size} superadmins.`);
    } catch (error) {
      logger.error("Error notifying superadmins:", { error });
    }
  }
);
