"use client";

import { useState, useEffect, useCallback } from "react";
import { Notification } from "@/types/notification";
import { NotificationService } from "@/services/notification-service";
import { useTenant } from "@/providers/tenant-provider";
import { toast } from "react-toastify";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
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

    const unsubscribe = NotificationService.subscribe(tenant.id, (notifs) => {
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.isRead).length);

      // Check for new notifications
      if (!isInitialLoad) {
        const newNotifs = notifs.filter(
          (n) => !previousIds.has(n.id) && !n.isRead,
        );

        newNotifs.forEach((n) => {
          toast.info(n.title || "Nova notificação", {
            position: "top-center",
            autoClose: 5000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });

          // Play a subtle sound if desired
          // const audio = new Audio('/notification.mp3');
          // audio.play().catch(e => console.log('Audio play failed', e));
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
    try {
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
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  };
}
