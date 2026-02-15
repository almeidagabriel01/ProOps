import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "./init";
import { SCHEDULE_OPTIONS } from "./deploymentConfig";
import { NotificationService } from "./api/services/notification.service";
import { runStripeSync } from "./stripe/stripeHelpers";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Cloud Function agendada que roda diariamente para verificar
 * o status das assinaturas Stripe e sincronizar com o Firestore.
 */
export const checkStripeSubscriptions = onSchedule(
  {
    ...SCHEDULE_OPTIONS,
    schedule: "every 24 hours",
    timeoutSeconds: 540, // 9 minutos, abaixo do limite máximo de 1h da v2, mas seguro para timeout de http
    memory: "512MiB",
  },
  async () => {
    console.log("Starting daily Stripe subscription check...");

    let totalSynced = 0;
    let totalFailed = 0;
    const allChanges: Array<{
      userId: string;
      oldStatus: string;
      newStatus: string;
    }> = [];

    // Loop until we process all users
    let hasMore = true;
    let startAfterId: string | undefined = undefined;
    const LIMIT = 200;

    while (hasMore) {
      console.log(`Processing batch starting after: ${startAfterId || "start"}`);
      try {
        const result = await runStripeSync(LIMIT, startAfterId, false);
        totalSynced += result.synced;
        totalFailed += result.failed;

        if (result.changes && result.changes.length > 0) {
          allChanges.push(...result.changes);
        }

        hasMore = result.hasMore && !!result.nextStartAfterId;
        startAfterId = result.nextStartAfterId || undefined;
      } catch (error) {
        console.error("Error processing batch:", error);
        // Break to avoid infinite loops on persistent errors
        hasMore = false;
      }
    }

    console.log(
      `Sync complete. Synced: ${totalSynced}, Failed: ${totalFailed}`
    );
    console.log(`Total changes detected: ${allChanges.length}`);

    // Modificado: Sempre notificar Super Admins, mesmo sem mudanças
    // If there are changes, notify Super Admins
    try {
      // Encontrar Super Admins
      // Encontrar Super Admins (case insensitive check)
      const superAdminsSnap = await db
        .collection("users")
        .where("role", "in", ["superadmin", "SUPERADMIN"])
        .get();

      if (superAdminsSnap.empty) {
        console.log("No superadmins found to notify.");
        return;
      }

      const title = "Sincronização de Assinaturas";

      const notificationPromises = superAdminsSnap.docs.map(
        async (adminDoc) => {

          // SEMPRE usar 'system' para notificações de sincronização global
          // Isso garante que o admin receba independente do tenant que ele está visualizando
          // O frontend já foi configurado para ouvir 'system' se o usuário for superadmin
          const tenantId = "system";

          let message = "";

          if (allChanges.length > 0) {
            message = `Sincronização concluída. ${allChanges.length} assinatura(s) tive(ram) o status alterado no Stripe.`;
          } else {
             message = `Sincronização diária concluída. Nenhuma alteração detectada. Total sincronizado: ${totalSynced}.`;
          }

          const existingSnap = await db
            .collection("notifications")
            .where("tenantId", "==", tenantId)
            .where("userId", "==", adminDoc.id)
            .where("type", "==", "system")
            .get();

          const stripeSyncDocs = existingSnap.docs.filter((doc) => {
            const data = doc.data() as {
              title?: string;
              createdAt?: string;
            };
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
            const aCreatedAt = new Date(
              String((a.data() as { createdAt?: string }).createdAt || 0),
            ).getTime();
            const bCreatedAt = new Date(
              String((b.data() as { createdAt?: string }).createdAt || 0),
            ).getTime();
            return bCreatedAt - aCreatedAt;
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
        }
      );

      await Promise.all(notificationPromises);
      console.log(`Notified ${superAdminsSnap.size} superadmins.`);
    } catch (error) {
      console.error("Error notifying superadmins:", error);
    }
  }
);
