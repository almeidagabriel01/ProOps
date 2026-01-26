import { db } from "../../init";

/**
 * Tipos de notificações
 */
export type NotificationType =
  | "proposal_viewed"
  | "proposal_approved"
  | "system";

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
}

/**
 * Service para gerenciar notificações do sistema
 */
export class NotificationService {
  private static COLLECTION = "notifications";

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
  ): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(notificationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error("Notification not found");
      }

      const data = doc.data() as Notification;

      // Validar que a notificação pertence ao tenant
      if (data.tenantId !== tenantId) {
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
}
