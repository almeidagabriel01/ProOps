"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Notification, NotificationType } from "@/types/notification";
import { NotificationService } from "@/services/notification-service";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { toast } from '@/lib/toast';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearingIds, setClearingIds] = useState<string[]>([]);
  const { tenant } = useTenant();
  const { user } = useAuth();

  // Track IDs that were deleted locally but might still be returned by the server
  // This prevents the "flicker" where a deleted notification reappears briefly
  const optimisticDeletedIds = useRef<Set<string>>(new Set());

  // Subscribe em tempo real às notificações
  useEffect(() => {
    const isSuperAdmin = user?.role?.toLowerCase() === "superadmin";

    if (!tenant && !isSuperAdmin) {
      setIsLoading(false);
      return;
    }

    // setIsLoading(true); // Removing to avoid sync state update

    // Keep track of initial load to avoid toast spam
    let isInitialLoad = true;
    let previousIds = new Set<string>();

    const tenantId = tenant?.id;

    const unsubscribe = NotificationService.subscribe(
      tenantId,
      async (serverNotifs) => {
        // 1. Clean up optimisticDeletedIds:
        // If an ID is in our ignore list BUT NOT in the server list, it means it was truly deleted
        // so we can stop tracking it.
        const serverIds = new Set(serverNotifs.map((n) => n.id));
        optimisticDeletedIds.current.forEach((id) => {
          if (!serverIds.has(id)) {
            optimisticDeletedIds.current.delete(id);
          }
        });

        // 2. Filter out notifications that we have locally deleted
        const notifs = serverNotifs.filter(
          (n) => !optimisticDeletedIds.current.has(n.id),
        );

        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.isRead).length);

        const newNotifs = notifs.filter(
          (n) => !previousIds.has(n.id) && !n.isRead,
        );

        if (!isInitialLoad) {
          const otherNotifs = newNotifs.filter(
            (n) =>
              n.type !== NotificationType.PROPOSAL_EXPIRING &&
              n.type !== NotificationType.TRANSACTION_DUE_REMINDER,
          );

          otherNotifs.forEach((n) => {
            toast.info(n.title || "Nova notificação", {
              position: "top-center",
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
            });
          });
        }

        // Update tracking set
        previousIds = new Set(notifs.map((n) => n.id));
        isInitialLoad = false;
        setIsLoading(false);
      },
      isSuperAdmin,
    );

    return () => {
      unsubscribe();
    };
  }, [tenant, user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(notificationId);
      // Atualização local otimista
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, isRead: true, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (isMarkingAllAsRead) return;

    try {
      setIsMarkingAllAsRead(true);
      await NotificationService.markAllAsRead(tenant?.id);
      // Atualização local otimista
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          isRead: true,
          readAt: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    } finally {
      setIsMarkingAllAsRead(false);
    }
  }, [isMarkingAllAsRead, tenant]);

  const clearNotification = useCallback(
    async (notificationId: string) => {
      if (clearingIds.includes(notificationId)) return;

      try {
        setClearingIds((prev) => [...prev, notificationId]);

        // Add to optimistic ignore list immediately
        optimisticDeletedIds.current.add(notificationId);

        const targetNotification = notifications.find(
          (n) => n.id === notificationId,
        );
        await NotificationService.deleteNotification(notificationId);

        // Optimistic update
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        if (targetNotification && !targetNotification.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error("Error clearing notification:", error);
        // Rollback optimistic add if error (optional, but good practice)
        optimisticDeletedIds.current.delete(notificationId);
      } finally {
        setClearingIds((prev) => prev.filter((id) => id !== notificationId));
      }
    },
    [clearingIds, notifications],
  );

  const clearAllNotifications = useCallback(async () => {
    if (isClearingAll) return;

    try {
      setIsClearingAll(true);

      // Add ALL current notifications to ignore list
      notifications.forEach((n) => optimisticDeletedIds.current.add(n.id));

      await NotificationService.clearAllNotifications(tenant?.id);

      // Optimistic update
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      // We could try to clear the set here, but it's tricky to know which ones failed.
      // Simplest is to leave them, they will reappear if the next sync brings them back.
    } finally {
      setIsClearingAll(false);
    }
  }, [isClearingAll, tenant, notifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    isMarkingAllAsRead,
    isClearingAll,
    clearingIds,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
  };
}
