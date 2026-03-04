"use client";

import { callApi } from "@/lib/api-client";
import {
  appendNotificationScopeSearchParams,
  NotificationScope,
} from "@/lib/notifications/scope";
import { Notification } from "@/types/notification";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Unsubscribe,
  where,
} from "firebase/firestore";

function buildScopeQueryString(scope: NotificationScope): string {
  const params = appendNotificationScopeSearchParams(new URLSearchParams(), scope);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export const NotificationService = {
  async getNotifications(options: {
    scope: NotificationScope;
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }): Promise<Notification[]> {
    try {
      const params = appendNotificationScopeSearchParams(
        new URLSearchParams(),
        options.scope,
      );

      if (options.limit) params.append("limit", options.limit.toString());
      if (options.offset) params.append("offset", options.offset.toString());
      if (options.unreadOnly) params.append("unreadOnly", "true");

      const response = await callApi<{
        success: boolean;
        notifications: Notification[];
      }>(`/v1/notifications?${params.toString()}`, "GET");

      return response.notifications;
    } catch (error) {
      console.error("Error getting notifications:", error);
      throw error;
    }
  },

  async markAsRead(
    notificationId: string,
    scope: NotificationScope,
  ): Promise<void> {
    try {
      await callApi(
        `/v1/notifications/${notificationId}/read${buildScopeQueryString(scope)}`,
        "PUT",
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  },

  async getUnreadCount(scope: NotificationScope): Promise<number> {
    try {
      const response = await callApi<{
        success: boolean;
        unreadCount: number;
      }>(`/v1/notifications/unread-count${buildScopeQueryString(scope)}`, "GET");

      return response.unreadCount;
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw error;
    }
  },

  async markAllAsRead(scope: NotificationScope): Promise<void> {
    try {
      await callApi(
        `/v1/notifications/mark-all-read${buildScopeQueryString(scope)}`,
        "PUT",
      );
    } catch (error) {
      console.error("Error marking all as read:", error);
      throw error;
    }
  },

  async deleteNotification(
    notificationId: string,
    scope: NotificationScope,
  ): Promise<void> {
    try {
      await callApi(
        `/v1/notifications/${notificationId}${buildScopeQueryString(scope)}`,
        "DELETE",
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  },

  async clearAllNotifications(scope: NotificationScope): Promise<void> {
    try {
      await callApi(
        `/v1/notifications/clear-all${buildScopeQueryString(scope)}`,
        "DELETE",
      );
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      throw error;
    }
  },

  async claimDailyDueToast(
    type: "transaction_due_reminder" | "proposal_expiring",
  ): Promise<boolean> {
    try {
      const response = await callApi<{
        success: boolean;
        shouldShow: boolean;
      }>("/v1/notifications/due-toast/claim", "POST", { type });

      return response.shouldShow;
    } catch (error) {
      console.error("Error claiming daily due toast:", error);
      return false;
    }
  },

  subscribe(
    scope: NotificationScope,
    callback: (notifications: Notification[]) => void,
  ): Unsubscribe {
    const startPollingSubscription = (): Unsubscribe => {
      let pollingInterval: ReturnType<typeof setInterval> | null = null;

      const fetchByApi = async () => {
        try {
          const notifications = await NotificationService.getNotifications({
            scope,
            limit: 50,
          });
          callback(notifications);
        } catch (error) {
          console.error("Error in notifications polling:", error);
        }
      };

      void fetchByApi();
      pollingInterval = setInterval(() => {
        void fetchByApi();
      }, 10000);

      return () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
      };
    };

    try {
      const notificationsRef = collection(db, "notifications");
      const notificationsQuery = query(
        notificationsRef,
        where(
          "tenantId",
          "==",
          scope.kind === "system" ? "system" : scope.tenantId,
        ),
        orderBy("createdAt", "desc"),
      );

      let pollingInterval: ReturnType<typeof setInterval> | null = null;

      const stopPolling = () => {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
      };

      const fetchByApi = async () => {
        try {
          const notifications = await NotificationService.getNotifications({
            scope,
            limit: 50,
          });
          callback(notifications);
        } catch (error) {
          console.error("Error in notifications polling fallback:", error);
        }
      };

      const startPollingFallback = () => {
        if (pollingInterval) return;

        void fetchByApi();
        pollingInterval = setInterval(() => {
          void fetchByApi();
        }, 10000);
      };

      const unsubscribeSnapshot = onSnapshot(
        notificationsQuery,
        (snapshot) => {
          stopPolling();

          const notifications: Notification[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Notification[];

          callback(notifications);
        },
        (error) => {
          console.error("Error in notifications subscription:", error);
          startPollingFallback();
        },
      );

      return () => {
        stopPolling();
        unsubscribeSnapshot();
      };
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      return startPollingSubscription();
    }
  },
};
