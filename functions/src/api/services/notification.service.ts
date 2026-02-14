import { db } from "../../init";

/**
 * Tipos de notificações
 */
export type NotificationType =
  | "proposal_viewed"
  | "proposal_approved"
  | "transaction_due_reminder"
  | "proposal_expiring"
  | "system";

export type DueToastType = "transaction_due_reminder" | "proposal_expiring";

/**
 * Interface para Notificação
 */
export interface Notification {
  id: string;
  tenantId: string;
  userId?: string; // Opcional: notificação para usuário específico
  type: NotificationType;
  title: string;
  message: string;
  proposalId?: string;
  sharedProposalId?: string;
  transactionId?: string;
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
}

/**
 * Service para gerenciar notificações do sistema
 */
export class NotificationService {
  private static COLLECTION = "notifications";
  private static DUE_TOAST_CLAIMS_COLLECTION = "notification_due_toast_claims";

  /**
   * Cria uma nova notificação
   */
  static async createNotification(
    data: CreateNotificationData,
  ): Promise<Notification> {
    try {
      const notification: Omit<Notification, "id"> = {
        ...data,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      const docRef = await db.collection(this.COLLECTION).add(notification);

      return {
        id: docRef.id,
        ...notification,
      };
    } catch (error) {
      console.error("Error creating notification:", error);
      throw new Error("Failed to create notification");
    }
  }

  /**
   * Busca notificações de um tenant com paginação
   */
  static async getNotifications(
    tenantId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {},
  ): Promise<Notification[]> {
    try {
      const { limit = 20, offset = 0, unreadOnly = false } = options;

      let query = db
        .collection(this.COLLECTION)
        .where("tenantId", "==", tenantId)
        .orderBy("createdAt", "desc");

      if (unreadOnly) {
        query = query.where("isRead", "==", false);
      }

      const snapshot = await query.limit(limit).offset(offset).get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
    } catch (error) {
      console.error("Error getting notifications:", error);
      throw new Error("Failed to get notifications");
    }
  }

  /**
   * Marca uma notificação como lida
   */
  static async markAsRead(
    notificationId: string,
    tenantId: string,
    isSuperAdmin: boolean = false,
  ): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(notificationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error("Notification not found");
      }

      const data = doc.data() as Notification;

      // Validar que a notificação pertence ao tenant
      if (data.tenantId !== tenantId && !isSuperAdmin) {
        throw new Error("Unauthorized: Notification does not belong to tenant");
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
   * Remove uma notificação de um tenant
   */
  static async deleteNotification(
    notificationId: string,
    tenantId: string,
    isSuperAdmin: boolean = false,
  ): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(notificationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error("Notification not found");
      }

      const data = doc.data() as Notification;
      if (data.tenantId !== tenantId && !isSuperAdmin) {
        throw new Error("Unauthorized: Notification does not belong to tenant");
      }

      await docRef.delete();
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  /**
   * Conta notificações não lidas de um tenant
   */
  static async getUnreadCount(tenantId: string): Promise<number> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("isRead", "==", false)
        .get();

      return snapshot.size;
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw new Error("Failed to get unread count");
    }
  }

  /**
   * Marca todas as notificações de um tenant como lidas
   */
  static async markAllAsRead(tenantId: string): Promise<void> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("isRead", "==", false)
        .get();

      const batch = db.batch();
      const readAt = new Date().toISOString();

      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          isRead: true,
          readAt,
        });
      });

      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
      throw new Error("Failed to mark all as read");
    }
  }

  /**
   * Remove todas as notificações de um tenant
   */
  static async clearAllNotifications(tenantId: string): Promise<void> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("tenantId", "==", tenantId)
        .get();

      if (snapshot.empty) return;

      const batches: FirebaseFirestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let opCount = 0;

      snapshot.docs.forEach((doc) => {
        currentBatch.delete(doc.ref);
        opCount++;

        if (opCount === 450) {
          batches.push(currentBatch);
          currentBatch = db.batch();
          opCount = 0;
        }
      });

      if (opCount > 0) {
        batches.push(currentBatch);
      }

      await Promise.all(batches.map((batch) => batch.commit()));
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      throw new Error("Failed to clear all notifications");
    }
  }

  /**
   * Encontra lembretes ativos (não lidos) para um recurso específico.
   * Usado para desduplicação (remover antigos antes de criar novos).
   */
  static async findActiveReminders(
    tenantId: string,
    type: NotificationType,
    resourceId: string,
    resourceField: "transactionId" | "proposalId",
  ): Promise<string[]> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("type", "==", type)
        .where(resourceField, "==", resourceId)
        .where("isRead", "==", false)
        .get();

      return snapshot.docs.map((doc) => doc.id);
    } catch (error) {
      console.error("Error finding active reminders:", error);
      return [];
    }
  }

  /**
   * Verifica se já existe uma notificação do mesmo tipo para o mesmo recurso no dia atual.
   * Usado para evitar duplicação no mesmo dia, mas permitir novo lembrete no dia seguinte.
   */
  static async findExistingReminder(
    tenantId: string,
    type: NotificationType,
    resourceId: string,
    resourceField: "transactionId" | "proposalId",
  ): Promise<boolean> {
    try {
      const todayPrefix = new Date().toISOString().split("T")[0]; // YYYY-MM-DD (UTC)

      const snapshot = await db
        .collection(this.COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("type", "==", type)
        .where(resourceField, "==", resourceId)
        .get();

      return snapshot.docs.some((doc) => {
        const createdAt = (doc.data().createdAt as string | undefined) || "";
        return createdAt.startsWith(todayPrefix);
      });
    } catch (error) {
      console.error("Error finding existing reminder:", error);
      return false;
    }
  }

  /**
   * Registra de forma atômica a exibição diária de toast para lembretes de vencimento.
   * Retorna true somente na primeira tentativa do dia para tenant+tipo.
   */
  static async claimDailyDueToast(
    tenantId: string,
    type: DueToastType,
    userId: string,
  ): Promise<boolean> {
    try {
      const dateKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
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
