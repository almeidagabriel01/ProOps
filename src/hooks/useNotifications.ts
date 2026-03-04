"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Notification, NotificationType } from "@/types/notification";
import { NotificationService } from "@/services/notification-service";
import { toast } from "@/lib/toast";
import { useNotificationScope } from "@/hooks/useNotificationScope";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearingIds, setClearingIds] = useState<string[]>([]);
  const { scope, scopeKey } = useNotificationScope();

  const notificationsRef = useRef<Notification[]>([]);
  const activeScopeKeyRef = useRef<string | null>(scopeKey);
  const subscriptionVersionRef = useRef(0);
  const optimisticDeletedIds = useRef<Set<string>>(new Set());
  const clearingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    activeScopeKeyRef.current = scopeKey;
  }, [scopeKey]);

  useEffect(() => {
    activeScopeKeyRef.current = scopeKey;
    optimisticDeletedIds.current = new Set();
    clearingIdsRef.current = new Set();
    notificationsRef.current = [];
    setNotifications([]);
    setUnreadCount(0);
    setClearingIds([]);
    setIsMarkingAllAsRead(false);
    setIsClearingAll(false);

    if (!scope || !scopeKey) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const subscriptionVersion = ++subscriptionVersionRef.current;
    let isActive = true;
    let isInitialLoad = true;
    let previousIds = new Set<string>();

    const applyNotifications = (serverNotifications: Notification[]) => {
      if (
        !isActive ||
        activeScopeKeyRef.current !== scopeKey ||
        subscriptionVersionRef.current !== subscriptionVersion
      ) {
        return;
      }

      const serverIds = new Set(serverNotifications.map((notification) => notification.id));
      optimisticDeletedIds.current.forEach((id) => {
        if (!serverIds.has(id)) {
          optimisticDeletedIds.current.delete(id);
        }
      });

      const nextNotifications = serverNotifications.filter(
        (notification) => !optimisticDeletedIds.current.has(notification.id),
      );
      const nextUnreadCount = nextNotifications.filter((notification) => !notification.isRead).length;
      const newUnreadNotifications = isInitialLoad
        ? []
        : nextNotifications.filter(
            (notification) => !notification.isRead && !previousIds.has(notification.id),
          );

      startTransition(() => {
        notificationsRef.current = nextNotifications;
        setNotifications(nextNotifications);
        setUnreadCount(nextUnreadCount);
        setIsLoading(false);
      });

      if (!isInitialLoad) {
        const toastableNotifications = newUnreadNotifications.filter(
          (notification) =>
            notification.type !== NotificationType.PROPOSAL_EXPIRING &&
            notification.type !== NotificationType.TRANSACTION_DUE_REMINDER,
        );

        toastableNotifications.forEach((notification) => {
          toast.info(notification.title || "Nova notificacao", {
            position: "top-center",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
        });
      }

      previousIds = new Set(nextNotifications.map((notification) => notification.id));
      isInitialLoad = false;
    };

    const unsubscribe = NotificationService.subscribe(scope, applyNotifications);

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [scope, scopeKey]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!scope || !scopeKey) return;

    const operationScope = scope;
    const operationScopeKey = scopeKey;
    const targetNotification = notificationsRef.current.find(
      (notification) => notification.id === notificationId,
    );

    try {
      await NotificationService.markAsRead(notificationId, operationScope);

      if (activeScopeKeyRef.current !== operationScopeKey) {
        return;
      }

      notificationsRef.current = notificationsRef.current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              isRead: true,
              readAt: new Date().toISOString(),
            }
          : notification,
      );

      setNotifications(notificationsRef.current);
      if (targetNotification && !targetNotification.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, [scope, scopeKey]);

  const markAllAsRead = useCallback(async () => {
    if (!scope || !scopeKey || isMarkingAllAsRead) return;

    const operationScope = scope;
    const operationScopeKey = scopeKey;

    try {
      setIsMarkingAllAsRead(true);
      await NotificationService.markAllAsRead(operationScope);

      if (activeScopeKeyRef.current !== operationScopeKey) {
        return;
      }

      const readAt = new Date().toISOString();
      notificationsRef.current = notificationsRef.current.map((notification) => ({
        ...notification,
        isRead: true,
        readAt,
      }));
      setNotifications(notificationsRef.current);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    } finally {
      if (activeScopeKeyRef.current === operationScopeKey) {
        setIsMarkingAllAsRead(false);
      }
    }
  }, [isMarkingAllAsRead, scope, scopeKey]);

  const clearNotification = useCallback(async (notificationId: string) => {
    if (!scope || !scopeKey || clearingIdsRef.current.has(notificationId)) return;

    const operationScope = scope;
    const operationScopeKey = scopeKey;
    const targetNotification = notificationsRef.current.find(
      (notification) => notification.id === notificationId,
    );

    try {
      clearingIdsRef.current.add(notificationId);
      setClearingIds((prev) => [...prev, notificationId]);
      optimisticDeletedIds.current.add(notificationId);

      await NotificationService.deleteNotification(notificationId, operationScope);

      if (activeScopeKeyRef.current !== operationScopeKey) {
        return;
      }

      notificationsRef.current = notificationsRef.current.filter(
        (notification) => notification.id !== notificationId,
      );
      setNotifications(notificationsRef.current);
      if (targetNotification && !targetNotification.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error clearing notification:", error);
      optimisticDeletedIds.current.delete(notificationId);
    } finally {
      clearingIdsRef.current.delete(notificationId);
      if (activeScopeKeyRef.current === operationScopeKey) {
        setClearingIds((prev) => prev.filter((id) => id !== notificationId));
      }
    }
  }, [scope, scopeKey]);

  const clearAllNotifications = useCallback(async () => {
    if (!scope || !scopeKey || isClearingAll) return;

    const operationScope = scope;
    const operationScopeKey = scopeKey;

    try {
      setIsClearingAll(true);
      notificationsRef.current.forEach((notification) => {
        optimisticDeletedIds.current.add(notification.id);
      });

      await NotificationService.clearAllNotifications(operationScope);

      if (activeScopeKeyRef.current !== operationScopeKey) {
        return;
      }

      notificationsRef.current = [];
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    } finally {
      if (activeScopeKeyRef.current === operationScopeKey) {
        setIsClearingAll(false);
      }
    }
  }, [isClearingAll, scope, scopeKey]);

  return {
    scope,
    scopeKey,
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
