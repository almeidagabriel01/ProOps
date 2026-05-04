import { db } from "../../init";
import {
  getNotificationScopeTenantId,
  isNotificationInScope,
  NotificationScope,
} from "../helpers/notification-scope";

export type NotificationType =
  | "proposal_viewed"
  | "proposal_approved"
  | "transaction_due_reminder"
  | "proposal_expiring"
  | "system"
  | "transaction_viewed";

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

export class NotificationService {
  private static COLLECTION = "notifications";
  private static DUE_TOAST_CLAIMS_COLLECTION = "notification_due_toast_claims";

  private static buildScopeQuery(
    scope: NotificationScope,
  ): FirebaseFirestore.Query {
    return db
      .collection(this.COLLECTION)
      .where("tenantId", "==", getNotificationScopeTenantId(scope));
  }

  private static assertNotificationScope(
    scope: NotificationScope,
    notification: Notification,
  ): void {
    if (!isNotificationInScope(scope, notification)) {
      throw new Error("Unauthorized: Notification is outside the active scope");
    }
  }

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

  static async getNotifications(
    scope: NotificationScope,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {},
  ): Promise<Notification[]> {
    try {
      const { limit = 20, offset = 0, unreadOnly = false } = options;

      let notificationsQuery = this.buildScopeQuery(scope);

      if (unreadOnly) {
        notificationsQuery = notificationsQuery.where("isRead", "==", false);
      }

      notificationsQuery = notificationsQuery.orderBy("createdAt", "desc");

      const snapshot = await notificationsQuery.limit(limit).offset(offset).get();

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
    } catch (error) {
      console.error("Error getting notifications:", error);
      throw new Error("Failed to get notifications");
    }
  }

  static async markAsRead(
    notificationId: string,
    scope: NotificationScope,
  ): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(notificationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error("Notification not found");
      }

      const data = doc.data() as Notification;
      this.assertNotificationScope(scope, data);

      await docRef.update({
        isRead: true,
        readAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  }

  static async deleteNotification(
    notificationId: string,
    scope: NotificationScope,
  ): Promise<void> {
    try {
      const docRef = db.collection(this.COLLECTION).doc(notificationId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error("Notification not found");
      }

      const data = doc.data() as Notification;
      this.assertNotificationScope(scope, data);

      await docRef.delete();
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  }

  static async getUnreadCount(scope: NotificationScope): Promise<number> {
    try {
      const snapshot = await this.buildScopeQuery(scope)
        .where("isRead", "==", false)
        .get();

      return snapshot.size;
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw new Error("Failed to get unread count");
    }
  }

  static async markAllAsRead(scope: NotificationScope): Promise<void> {
    try {
      const snapshot = await this.buildScopeQuery(scope)
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

  static async clearAllNotifications(scope: NotificationScope): Promise<void> {
    try {
      const batchSize = 400;
      let hasMore = true;

      while (hasMore) {
        const snapshot = await this.buildScopeQuery(scope).limit(batchSize).get();

        if (snapshot.empty) {
          hasMore = false;
          continue;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();

        if (snapshot.size < batchSize) {
          hasMore = false;
        }
      }
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      throw new Error("Failed to clear all notifications");
    }
  }

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

  static async findExistingReminder(
    tenantId: string,
    type: NotificationType,
    resourceId: string,
    resourceField: "transactionId" | "proposalId",
  ): Promise<boolean> {
    try {
      const todayPrefix = new Date().toISOString().split("T")[0];

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
