"use client";

import { useState, useEffect, useCallback } from "react";
import { Notification, NotificationType } from "@/types/notification";
import { NotificationService } from "@/services/notification-service";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "react-toastify";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearingIds, setClearingIds] = useState<string[]>([]);
  const { tenant } = useTenant();

  // Subscribe em tempo real às notificações
  useEffect(() => {
    if (!tenant) {
      if (isLoading) {
        setTimeout(() => setIsLoading(false), 0);
      }
      return;
    }

    // setIsLoading(true); // Removing to avoid sync state update

    // Keep track of initial load to avoid toast spam
    let isInitialLoad = true;
    let previousIds = new Set<string>();

    const unsubscribe = NotificationService.subscribe(tenant.id, async (notifs) => {
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.isRead).length);

      const newNotifs = notifs.filter((n) => !previousIds.has(n.id) && !n.isRead);
      const notifsToProcess = isInitialLoad ? notifs.filter((n) => !n.isRead) : newNotifs;

      const proposalDueNotifs = notifsToProcess.filter(
        (n) => n.type === NotificationType.PROPOSAL_EXPIRING,
      );

      const transactionDueNotifs = notifsToProcess.filter(
        (n) => n.type === NotificationType.TRANSACTION_DUE_REMINDER,
      );

      if (proposalDueNotifs.length > 0) {
        const shouldShowProposalToast = await NotificationService.claimDailyDueToast(
          "proposal_expiring",
        );

        if (shouldShowProposalToast) {
          toast.warn("Há propostas próximas do vencimento ou vencidas.", {
            position: "top-center",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      }

      if (transactionDueNotifs.length > 0) {
        const shouldShowTransactionToast =
          await NotificationService.claimDailyDueToast(
            "transaction_due_reminder",
          );

        if (shouldShowTransactionToast) {
          toast.warn("Há lançamentos próximos do vencimento ou vencidos.", {
            position: "top-center",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        }
      }

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
    });

    return () => {
      unsubscribe();
    };
  }, [tenant, isLoading]);

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
      await NotificationService.markAllAsRead();
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
  }, [isMarkingAllAsRead]);

  const clearNotification = useCallback(async (notificationId: string) => {
    if (clearingIds.includes(notificationId)) return;

    try {
      setClearingIds((prev) => [...prev, notificationId]);
      const targetNotification = notifications.find((n) => n.id === notificationId);
      await NotificationService.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (targetNotification && !targetNotification.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error clearing notification:", error);
    } finally {
      setClearingIds((prev) => prev.filter((id) => id !== notificationId));
    }
  }, [clearingIds, notifications]);

  const clearAllNotifications = useCallback(async () => {
    if (isClearingAll) return;

    try {
      setIsClearingAll(true);
      await NotificationService.clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    } finally {
      setIsClearingAll(false);
    }
  }, [isClearingAll]);

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
