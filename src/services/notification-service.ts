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
      targetTenantId?: string;
    } = {},
  ): Promise<Notification[]> => {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append("limit", options.limit.toString());
      if (options.offset) params.append("offset", options.offset.toString());
      if (options.unreadOnly) params.append("unreadOnly", "true");
      if (options.targetTenantId) params.append("targetTenantId", options.targetTenantId);

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
  markAllAsRead: async (tenantId?: string): Promise<void> => {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.append("targetTenantId", tenantId);

      const queryString = params.toString() ? `?${params.toString()}` : "";
      await callApi(`/v1/notifications/mark-all-read${queryString}`, "PUT");
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
  clearAllNotifications: async (tenantId?: string): Promise<void> => {
    try {
      const params = new URLSearchParams();
      if (tenantId) params.append("targetTenantId", tenantId);

      const queryString = params.toString() ? `?${params.toString()}` : "";
      await callApi(`/v1/notifications/clear-all${queryString}`, "DELETE");
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
   * @param isSuperAdmin Se o usuário é super admin (para ouvir 'system')
   * @param callback Função chamada quando há mudanças
   * @returns Função para cancelar subscription
   */
  subscribe: (
    tenantId: string | undefined,
    callback: (notifications: Notification[]) => void,
    isSuperAdmin: boolean = false,
  ): Unsubscribe => {
    try {
      const tenantIds = isSuperAdmin
        ? tenantId
          ? [tenantId] // Se tem tenantId, Super Admin só ouve esse tenant (sem system)
          : ["system"] // Se não tem tenantId (painel geral), ouve system
        : tenantId
          ? [tenantId]
          : [];

      if (tenantIds.length === 0) {
        callback([]);
        return () => {};
      }

      const notificationsRef = collection(db, "notifications");
      
      // Se for super admin, ouve tenantId OU system (usando 'in')
      // Se for usuário normal, APENAS tenantId
      const q = query(
        notificationsRef,
        where("tenantId", "in", tenantIds),
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
        q,
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
          // Se der erro de permissão (ex: tenant normal tentando ler system), 
          // tenta fallback apenas para o tenant dele se a query falhou
          if (isSuperAdmin && error.code === 'permission-denied') {
             console.warn("SuperAdmin permission denied on 'system' check. Falling back to tenant only.");
             // Aqui poderiamos tentar refazer a query sem 'system', mas o fallback via API deve resolver
          }
          startPollingFallback();
        },
      );

      return () => {
        stopPolling();
        unsubscribeSnapshot();
      };
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      let pollingInterval: ReturnType<typeof setInterval> | null = null;

      const fetchByApi = async () => {
        try {
          const notifications = await NotificationService.getNotifications({
            limit: 50,
            targetTenantId: tenantId,
          });
          callback(notifications);
        } catch (pollError) {
          console.error("Error in notifications startup fallback:", pollError);
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
    }
  },
};
