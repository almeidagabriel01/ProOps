import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { resolveFrontendAppOrigin } from "../../lib/frontend-app-url";
import { sendEmail } from "../../services/email/send-email";
import {
  renderNotificationEmail,
  renderNotificationEmailText,
} from "../../services/email/templates/notification";
import {
  NOTIFICATION_CATALOG,
  notificationLinkPath,
  type NotificationType,
} from "../../shared/notification-catalog";
import {
  getNotificationScopeTenantId,
  isNotificationInScope,
  NotificationScope,
} from "../helpers/notification-scope";
import {
  resolveTenantRecipients,
  type NotificationRecipients,
} from "./notification-audience";

export type { NotificationType } from "../../shared/notification-catalog";

export type DueToastType = "transaction_due_reminder" | "proposal_expiring";

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  proposalId?: string;
  sharedProposalId?: string;
  transactionId?: string;
  leadId?: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  bookingRequestId?: string;
  /** Quem vê esta notificação. As rules leem este campo. */
  recipientUids?: string[];
  /** Quem já leu. A leitura é por pessoa desde a central de notificações. */
  readBy?: string[];
  /** Leitura da empresa inteira: só o escopo do superadmin ainda usa. */
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface CreateNotificationData {
  tenantId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  proposalId?: string;
  sharedProposalId?: string;
  transactionId?: string;
  leadId?: string;
  clientId?: string;
  projectId?: string;
  taskId?: string;
  bookingRequestId?: string;
  /** Obrigatório nos tipos diretos (tarefa atribuída, menção): quem é avisado. */
  targetUids?: string[];
}

/**
 * Quem está olhando. `perRecipient` é o caso normal: a pessoa vê só o que foi
 * endereçado a ela e lê por conta própria. O superadmin (escopo `system` ou
 * vendo uma empresa pelo painel) continua na visão da empresa inteira.
 */
export interface NotificationViewer {
  uid: string;
  perRecipient: boolean;
}

const SYSTEM_TENANT_ID = "system";
const PAGE_SIZE = 400;

type EmailRecipient = NotificationRecipients["emailRecipients"][number];

function isReadBy(data: { readBy?: string[]; isRead?: boolean }, viewer: NotificationViewer) {
  return viewer.perRecipient ? (data.readBy ?? []).includes(viewer.uid) : data.isRead === true;
}

export class NotificationService {
  private static COLLECTION = "notifications";
  private static DUE_TOAST_CLAIMS_COLLECTION = "notification_due_toast_claims";

  private static buildScopeQuery(
    scope: NotificationScope,
    viewer?: NotificationViewer,
  ): FirebaseFirestore.Query {
    const query = db
      .collection(this.COLLECTION)
      .where("tenantId", "==", getNotificationScopeTenantId(scope));
    return viewer?.perRecipient
      ? query.where("recipientUids", "array-contains", viewer.uid)
      : query;
  }

  private static assertNotificationScope(
    scope: NotificationScope,
    notification: Notification,
    viewer?: NotificationViewer,
  ): void {
    if (!isNotificationInScope(scope, notification)) {
      throw new Error("Unauthorized: Notification is outside the active scope");
    }
    if (viewer?.perRecipient && !(notification.recipientUids ?? []).includes(viewer.uid)) {
      throw new Error("Notification not found");
    }
  }

  /**
   * Destinatários de um tipo, para quem grava a notificação por conta própria
   * (os crons usam BulkWriter e id fixo). `readBy: []` zera a leitura: um
   * lembrete regravado volta como não lido para todos.
   */
  static async recipientFields(
    tenantId: string,
    type: NotificationType,
    targetUids?: string[],
  ): Promise<{ fields: { recipientUids: string[]; readBy: string[] }; emailRecipients: EmailRecipient[] }> {
    if (tenantId === SYSTEM_TENANT_ID) {
      return { fields: { recipientUids: [], readBy: [] }, emailRecipients: [] };
    }
    const { recipientUids, emailRecipients } = await resolveTenantRecipients(
      tenantId,
      type,
      targetUids,
    );
    return { fields: { recipientUids, readBy: [] }, emailRecipients };
  }

  /**
   * Manda o aviso por e-mail a quem ligou o tipo. Nunca lança: a notificação
   * já existe na central, e o e-mail é conveniência. Aguardado por quem chama,
   * porque no Cloud Run promessa pendente ao fim da request é trabalho perdido.
   */
  static async sendNotificationEmails(
    notification: Pick<Notification, "tenantId" | "type" | "title" | "message"> &
      Partial<
        Pick<
          Notification,
          "proposalId" | "transactionId" | "leadId" | "clientId" | "projectId" | "taskId" | "bookingRequestId"
        >
      >,
    recipients: EmailRecipient[],
  ): Promise<void> {
    if (recipients.length === 0 || !NOTIFICATION_CATALOG[notification.type]?.emailable) return;

    const origin = resolveFrontendAppOrigin();
    const props = {
      title: notification.title,
      message: notification.message,
      actionUrl: `${origin}${notificationLinkPath(notification)}`,
      preferencesUrl: `${origin}/notifications?tab=preferencias`,
    };
    const html = renderNotificationEmail(props);
    const text = renderNotificationEmailText(props);

    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        sendEmail({
          to: recipient.email,
          subject: notification.title,
          html,
          text,
          tenantId: notification.tenantId,
          type: `notification_${notification.type}`,
        }),
      ),
    );
    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
    ).length;
    if (failed > 0) {
      logger.warn("Aviso de notificação por e-mail falhou", {
        tenantId: notification.tenantId,
        type: notification.type,
        falhas: failed,
        total: recipients.length,
      });
    }
  }

  static async createNotification(
    data: CreateNotificationData,
  ): Promise<Notification> {
    try {
      const { targetUids, ...rest } = data;
      const { fields, emailRecipients } = await this.recipientFields(
        data.tenantId,
        data.type,
        targetUids,
      );
      const notification: Omit<Notification, "id"> = {
        ...rest,
        ...fields,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      const docRef = await db.collection(this.COLLECTION).add(notification);
      await this.sendNotificationEmails(notification, emailRecipients);

      return {
        id: docRef.id,
        ...notification,
      };
    } catch (error) {
      console.error("Error creating notification:", error);
      throw new Error("Failed to create notification");
    }
  }

  static async getNotifications(
    scope: NotificationScope,
    viewer: NotificationViewer,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {},
  ): Promise<Notification[]> {
    try {
      const { limit = 20, offset = 0, unreadOnly = false } = options;

      let notificationsQuery = this.buildScopeQuery(scope, viewer);

      // Leitura por pessoa não é consultável ("não contém"): filtra depois.
      if (unreadOnly && !viewer.perRecipient) {
        notificationsQuery = notificationsQuery.where("isRead", "==", false);
      }

      notificationsQuery = notificationsQuery.orderBy("createdAt", "desc");

      const snapshot = await notificationsQuery.limit(limit).offset(offset).get();

      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];

      return unreadOnly && viewer.perRecipient
        ? notifications.filter((n) => !isReadBy(n, viewer))
        : notifications;
    } catch (error) {
      console.error("Error getting notifications:", error);
      throw new Error("Failed to get notifications");
    }
  }

  static async markAsRead(
    notificationId: string,
    scope: NotificationScope,
    viewer: NotificationViewer,
  ): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(notificationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error("Notification not found");
      }

      const data = doc.data() as Notification;
      this.assertNotificationScope(scope, data, viewer);

      if (viewer.perRecipient) {
        await docRef.update({ readBy: FieldValue.arrayUnion(viewer.uid) });
        return;
      }

      await docRef.update({
        isRead: true,
        readAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Tira a notificação da central de quem pediu. Por pessoa, os outros
   * destinatários continuam com ela; o documento só some com o último.
   */
  static async deleteNotification(
    notificationId: string,
    scope: NotificationScope,
    viewer: NotificationViewer,
  ): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(notificationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error("Notification not found");
      }

      const data = doc.data() as Notification;
      this.assertNotificationScope(scope, data, viewer);

      if (!viewer.perRecipient) {
        await docRef.delete();
        return;
      }

      const remaining = (data.recipientUids ?? []).filter((uid) => uid !== viewer.uid);
      if (remaining.length === 0) {
        await docRef.delete();
      } else {
        await docRef.update({
          recipientUids: FieldValue.arrayRemove(viewer.uid),
          readBy: FieldValue.arrayRemove(viewer.uid),
        });
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  static async getUnreadCount(
    scope: NotificationScope,
    viewer: NotificationViewer,
  ): Promise<number> {
    try {
      if (viewer.perRecipient) {
        // Mesma janela do sino: as 50 mais recentes.
        const snapshot = await this.buildScopeQuery(scope, viewer)
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();
        return snapshot.docs.filter((doc) => !isReadBy(doc.data(), viewer)).length;
      }

      // Aggregation count(): cobra 1 leitura por 1000 docs contados, em vez de
      // buscar todos os documentos. Este endpoint é polado pelo frontend.
      const snapshot = await this.buildScopeQuery(scope)
        .where("isRead", "==", false)
        .count()
        .get();

      return snapshot.data().count;
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw new Error("Failed to get unread count");
    }
  }

  static async markAllAsRead(
    scope: NotificationScope,
    viewer: NotificationViewer,
  ): Promise<void> {
    try {
      if (viewer.perRecipient) {
        let last: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        for (;;) {
          let query = this.buildScopeQuery(scope, viewer)
            .orderBy("createdAt", "desc")
            .limit(PAGE_SIZE);
          if (last) query = query.startAfter(last);
          const snapshot = await query.get();
          if (snapshot.empty) break;

          const unread = snapshot.docs.filter((doc) => !isReadBy(doc.data(), viewer));
          if (unread.length > 0) {
            const batch = db.batch();
            unread.forEach((doc) => {
              batch.update(doc.ref, { readBy: FieldValue.arrayUnion(viewer.uid) });
            });
            await batch.commit();
          }

          if (snapshot.size < PAGE_SIZE) break;
          last = snapshot.docs[snapshot.docs.length - 1];
        }
        return;
      }

      for (;;) {
        const snapshot = await this.buildScopeQuery(scope)
          .where("isRead", "==", false)
          .limit(PAGE_SIZE)
          .get();
        if (snapshot.empty) break;

        const batch = db.batch();
        const readAt = new Date().toISOString();
        snapshot.docs.forEach((doc) => {
          batch.update(doc.ref, { isRead: true, readAt });
        });
        await batch.commit();

        if (snapshot.size < PAGE_SIZE) break;
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
      throw new Error("Failed to mark all as read");
    }
  }

  static async clearAllNotifications(
    scope: NotificationScope,
    viewer: NotificationViewer,
  ): Promise<void> {
    try {
      // Cada página sai da consulta (a pessoa deixa de ser destinatária, ou o
      // documento é apagado), então a próxima volta sem cursor.
      for (;;) {
        // Por pessoa, ordena para usar o mesmo índice do sino.
        const base = this.buildScopeQuery(scope, viewer);
        const snapshot = await (viewer.perRecipient ? base.orderBy("createdAt", "desc") : base)
          .limit(PAGE_SIZE)
          .get();
        if (snapshot.empty) break;

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          if (!viewer.perRecipient) {
            batch.delete(doc.ref);
            return;
          }
          const recipients = (doc.data().recipientUids as string[] | undefined) ?? [];
          if (recipients.every((uid) => uid === viewer.uid)) {
            batch.delete(doc.ref);
          } else {
            batch.update(doc.ref, {
              recipientUids: FieldValue.arrayRemove(viewer.uid),
              readBy: FieldValue.arrayRemove(viewer.uid),
            });
          }
        });
        await batch.commit();

        if (snapshot.size < PAGE_SIZE) break;
      }
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      throw new Error("Failed to clear all notifications");
    }
  }

  static async claimDailyDueToast(
    tenantId: string,
    type: DueToastType,
    userId: string,
  ): Promise<boolean> {
    try {
      const dateKey = new Date().toISOString().split("T")[0];
      const claimId = `${tenantId}_${type}_${dateKey}`;
      const claimRef = db
        .collection(this.DUE_TOAST_CLAIMS_COLLECTION)
        .doc(claimId);

      await claimRef.create({
        tenantId,
        type,
        dateKey,
        claimedBy: userId,
        createdAt: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      const code = (error as { code?: number | string })?.code;
      if (code === 6 || code === "already-exists") {
        return false;
      }

      console.error("Error claiming daily due toast:", error);
      throw new Error("Failed to claim daily due toast");
    }
  }
}
