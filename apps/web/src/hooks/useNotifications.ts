"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Notification, NotificationType } from "@/types/notification";
import { NotificationService } from "@/services/notification-service";
import { toast } from "@/lib/toast";
import { useNotificationScope } from "@/hooks/useNotificationScope";
import { useTenant } from "@/providers/tenant-provider";
import { useEffectiveViewer } from "@/hooks/use-effective-viewer";
import {
  isNotificationRead,
  markReadFor,
  resolveNotificationViewer,
} from "@/lib/notifications/viewer";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [clearingIds, setClearingIds] = useState<string[]>([]);
  const { scope, scopeKey } = useNotificationScope();
  const { tenant, isDemo: isDemoTenant } = useTenant();
  // No "Ver como membro" o sino mostra o que chegou para o membro.
  const { uid: viewerUid, role: viewerRole, isMemberView } = useEffectiveViewer();

  const viewer = useMemo(
    () =>
      resolveNotificationViewer({
        uid: viewerUid,
        role: viewerRole,
        scope,
        demoTenantId: isDemoTenant ? tenant?.id : null,
      }),
    [scope, viewerUid, viewerRole, isDemoTenant, tenant?.id],
  );
  const viewerKey =
    viewer && scopeKey
      ? `${scopeKey}:${viewer.mode}:${viewer.uid}:${viewer.demoTenantId ?? ""}`
      : null;
  // A conta free só lê as notificações de exemplo, e o superadmin vendo um
  // membro não marca nada como lido em nome dele: nada é gravado.
  const isReadOnly = viewer?.mode === "demo" || isMemberView;

  const notificationsRef = useRef<Notification[]>([]);
  const activeViewerKeyRef = useRef<string | null>(viewerKey);
  const subscriptionVersionRef = useRef(0);
  const optimisticDeletedIds = useRef<Set<string>>(new Set());
  const clearingIdsRef = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(
    () => notifications.filter((n) => !isNotificationRead(n, viewer)).length,
    [notifications, viewer],
  );

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    activeViewerKeyRef.current = viewerKey;
  }, [viewerKey]);

  useEffect(() => {
    activeViewerKeyRef.current = viewerKey;
    optimisticDeletedIds.current = new Set();
    clearingIdsRef.current = new Set();
    notificationsRef.current = [];
    setNotifications([]);
    setClearingIds([]);
    setIsMarkingAllAsRead(false);
    setIsClearingAll(false);

    if (!scope || !viewer || !viewerKey) {
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
        activeViewerKeyRef.current !== viewerKey ||
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
      const newUnreadNotifications = isInitialLoad
        ? []
        : nextNotifications.filter(
            (notification) =>
              !isNotificationRead(notification, viewer) && !previousIds.has(notification.id),
          );

      startTransition(() => {
        notificationsRef.current = nextNotifications;
        setNotifications(nextNotifications);
        setIsLoading(false);
      });

      if (!isInitialLoad) {
        const toastableNotifications = newUnreadNotifications.filter(
          (notification) =>
            notification.type !== NotificationType.PROPOSAL_EXPIRING &&
            notification.type !== NotificationType.TRANSACTION_DUE_REMINDER,
        );

        toastableNotifications.forEach((notification) => {
          toast.info(notification.title || "Nova notificação", {
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

    const unsubscribe = NotificationService.subscribe(scope, viewer, applyNotifications);

    return () => {
      isActive = false;
      unsubscribe();
    };
    // `viewerKey` resume scope e viewer: resubscrever por identidade de objeto
    // refaria o listener a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerKey]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!scope || !viewerKey || isReadOnly) return;

    const operationScope = scope;
    const operationViewerKey = viewerKey;
    const target = notificationsRef.current.find((n) => n.id === notificationId);
    if (!target || isNotificationRead(target, viewer)) return;

    // Otimista: a lista marca na hora e volta atrás se o servidor recusar.
    notificationsRef.current = notificationsRef.current.map((n) =>
      n.id === notificationId ? markReadFor(n, viewer) : n,
    );
    setNotifications(notificationsRef.current);

    try {
      await NotificationService.markAsRead(notificationId, operationScope);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      if (activeViewerKeyRef.current !== operationViewerKey) return;
      notificationsRef.current = notificationsRef.current.map((n) =>
        n.id === notificationId ? target : n,
      );
      setNotifications(notificationsRef.current);
    }
  }, [isReadOnly, scope, viewer, viewerKey]);

  const markAllAsRead = useCallback(async () => {
    if (!scope || !viewerKey || isMarkingAllAsRead || isReadOnly) return;

    const operationScope = scope;
    const operationViewerKey = viewerKey;

    try {
      setIsMarkingAllAsRead(true);
      await NotificationService.markAllAsRead(operationScope);

      if (activeViewerKeyRef.current !== operationViewerKey) {
        return;
      }

      notificationsRef.current = notificationsRef.current.map((n) => markReadFor(n, viewer));
      setNotifications(notificationsRef.current);
    } catch (error) {
      console.error("Error marking all as read:", error);
    } finally {
      if (activeViewerKeyRef.current === operationViewerKey) {
        setIsMarkingAllAsRead(false);
      }
    }
  }, [isMarkingAllAsRead, isReadOnly, scope, viewer, viewerKey]);

  const clearNotification = useCallback(async (notificationId: string) => {
    if (!scope || !viewerKey || isReadOnly || clearingIdsRef.current.has(notificationId)) return;

    const operationScope = scope;
    const operationViewerKey = viewerKey;

    try {
      clearingIdsRef.current.add(notificationId);
      setClearingIds((prev) => [...prev, notificationId]);
      optimisticDeletedIds.current.add(notificationId);

      await NotificationService.deleteNotification(notificationId, operationScope);

      if (activeViewerKeyRef.current !== operationViewerKey) {
        return;
      }

      notificationsRef.current = notificationsRef.current.filter(
        (notification) => notification.id !== notificationId,
      );
      setNotifications(notificationsRef.current);
    } catch (error) {
      console.error("Error clearing notification:", error);
      optimisticDeletedIds.current.delete(notificationId);
    } finally {
      clearingIdsRef.current.delete(notificationId);
      if (activeViewerKeyRef.current === operationViewerKey) {
        setClearingIds((prev) => prev.filter((id) => id !== notificationId));
      }
    }
  }, [isReadOnly, scope, viewerKey]);

  const clearAllNotifications = useCallback(async () => {
    if (!scope || !viewerKey || isClearingAll || isReadOnly) return;

    const operationScope = scope;
    const operationViewerKey = viewerKey;

    try {
      setIsClearingAll(true);
      notificationsRef.current.forEach((notification) => {
        optimisticDeletedIds.current.add(notification.id);
      });

      await NotificationService.clearAllNotifications(operationScope);

      if (activeViewerKeyRef.current !== operationViewerKey) {
        return;
      }

      notificationsRef.current = [];
      setNotifications([]);
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    } finally {
      if (activeViewerKeyRef.current === operationViewerKey) {
        setIsClearingAll(false);
      }
    }
  }, [isClearingAll, isReadOnly, scope, viewerKey]);

  const isRead = useCallback(
    (notification: Notification) => isNotificationRead(notification, viewer),
    [viewer],
  );

  return {
    scope,
    scopeKey,
    viewer,
    isReadOnly,
    notifications,
    unreadCount,
    isLoading,
    isMarkingAllAsRead,
    isClearingAll,
    clearingIds,
    isRead,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
  };
}
