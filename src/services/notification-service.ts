"use client";

import { callApi } from "@/lib/api-client";
import { Notification } from "@/types/notification";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

export const NotificationService = {
  /**
   * Busca notificações do tenant
   */
  getNotifications: async (
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {},
  ): Promise<Notification[]> => {
    try {
      const params = new URLSearchParams();
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

  /**
   * Marca uma notificação como lida
   */
  markAsRead: async (notificationId: string): Promise<void> => {
    try {
      await callApi(`/v1/notifications/${notificationId}/read`, "PUT");
    } catch (error) {
      console.error("Error marking notification as read:", error);
      throw error;
    }
  },

  /**
   * Busca contador de notificações não lidas
   */
  getUnreadCount: async (): Promise<number> => {
    try {
      const response = await callApi<{
        success: boolean;
        unreadCount: number;
      }>("/v1/notifications/unread-count", "GET");

      return response.unreadCount;
    } catch (error) {
      console.error("Error getting unread count:", error);
      throw error;
    }
  },

  /**
   * Marca todas as notificações como lidas
   */
  markAllAsRead: async (): Promise<void> => {
    try {
      await callApi("/v1/notifications/mark-all-read", "PUT");
    } catch (error) {
      console.error("Error marking all as read:", error);
      throw error;
    }
  },

  /**
   * Remove uma notificação
   */
  deleteNotification: async (notificationId: string): Promise<void> => {
    try {
      await callApi(`/v1/notifications/${notificationId}`, "DELETE");
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  },

  /**
   * Remove todas as notificações
   */
  clearAllNotifications: async (): Promise<void> => {
    try {
      await callApi("/v1/notifications/clear-all", "DELETE");
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      throw error;
    }
  },

  /**
   * Solicita ao backend claim diário para exibição de toast por tipo.
   * Retorna true apenas na primeira exibição do dia.
   */
  claimDailyDueToast: async (
    type: "transaction_due_reminder" | "proposal_expiring",
  ): Promise<boolean> => {
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

  /**
   * Subscreve a notificações em tempo real
   * @param tenantId ID do tenant
   * @param callback Função chamada quando há mudanças
   * @returns Função para cancelar subscription
   */
  subscribe: (
    tenantId: string,
    callback: (notifications: Notification[]) => void,
  ): Unsubscribe => {
    try {
      const notificationsRef = collection(db, "notifications");
      const q = query(
        notificationsRef,
        where("tenantId", "==", tenantId),
        orderBy("createdAt", "desc"),
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const notifications: Notification[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Notification[];
          callback(notifications);
        },
        (error) => {
          console.error("Error in notifications subscription:", error);
        },
      );
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      // Retornar função vazia de unsubscribe em caso de erro
      return () => {};
    }
  },
};
