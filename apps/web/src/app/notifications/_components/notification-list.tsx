"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  getNotificationIcon,
  getNotificationIconClassName,
} from "@/components/notifications/notification-visuals";
import type { useNotifications } from "@/hooks/useNotifications";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { NOTIFICATION_GROUPS, catalogEntry, type NotificationGroup } from "@/lib/notifications/catalog";
import { formatNotificationTime } from "@/lib/notifications/format-time";
import { notificationLinkPath } from "@/lib/notifications/links";
import { isNotificationRead, markReadFor } from "@/lib/notifications/viewer";
import { NotificationService } from "@/services/notification-service";
import type { Notification, NotificationType } from "@/types/notification";

const PAGE_SIZE = 50;

interface NotificationListProps {
  state: ReturnType<typeof useNotifications>;
}

function groupOf(notification: Notification): NotificationGroup {
  return catalogEntry(notification.type)?.group ?? "system";
}

/**
 * Lista da central. As 50 mais recentes chegam em tempo real (o mesmo listener
 * do sino); "Carregar mais" busca as anteriores pela API, sob demanda.
 */
export function NotificationList({ state }: NotificationListProps) {
  const router = useRouter();
  const {
    scope,
    viewer,
    isReadOnly,
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
  } = state;

  const [readFilter, setReadFilter] = React.useState<"all" | "unread">("all");
  const [groupFilter, setGroupFilter] = React.useState<"all" | NotificationGroup>("all");
  const [older, setOlder] = React.useState<Notification[]>([]);
  const [olderExhausted, setOlderExhausted] = React.useState(false);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = React.useState(false);

  const all = React.useMemo(() => {
    const recentIds = new Set(notifications.map((n) => n.id));
    return [...notifications, ...older.filter((n) => !recentIds.has(n.id))];
  }, [notifications, older]);

  const groups = React.useMemo(() => {
    const present = new Set(all.map(groupOf));
    return NOTIFICATION_GROUPS.filter((g) => present.has(g.id));
  }, [all]);

  const visible = all.filter(
    (n) =>
      (readFilter === "all" || !isNotificationRead(n, viewer)) &&
      (groupFilter === "all" || groupOf(n) === groupFilter),
  );

  const canLoadOlder =
    !isReadOnly && !olderExhausted && notifications.length >= PAGE_SIZE && scope !== null;

  const loadOlder = async () => {
    if (!scope) return;
    setLoadingOlder(true);
    try {
      const page = await NotificationService.getNotifications({
        scope,
        limit: PAGE_SIZE,
        offset: notifications.length + older.length,
      });
      setOlder((prev) => [...prev, ...page]);
      if (page.length < PAGE_SIZE) setOlderExhausted(true);
    } catch {
      toast.error("Não foi possível carregar as notificações anteriores.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const isOlder = (id: string) => !notifications.some((n) => n.id === id);

  const open = (notification: Notification) => {
    if (!isReadOnly && !isNotificationRead(notification, viewer)) {
      if (isOlder(notification.id) && scope) {
        setOlder((prev) => prev.map((n) => (n.id === notification.id ? markReadFor(n, viewer) : n)));
        void NotificationService.markAsRead(notification.id, scope).catch(() => undefined);
      } else {
        void markAsRead(notification.id);
      }
    }
    const link = notificationLinkPath(notification);
    if (link !== "/notifications") router.push(link);
  };

  const remove = async (notification: Notification) => {
    if (isOlder(notification.id) && scope) {
      setOlder((prev) => prev.filter((n) => n.id !== notification.id));
      try {
        await NotificationService.deleteNotification(notification.id, scope);
      } catch {
        setOlder((prev) => [...prev, notification]);
        toast.error("Não foi possível remover a notificação.");
      }
      return;
    }
    await clearNotification(notification.id);
  };

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
            <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <SegmentedControl
            id="notifications-read-filter"
            value={readFilter}
            onChange={(v) => setReadFilter(v as "all" | "unread")}
            options={[
              { value: "all", label: "Todas" },
              { value: "unread", label: "Não lidas", count: unreadCount },
            ]}
          />
          {groups.length > 1 && (
            <SegmentedControl
              id="notifications-group-filter"
              value={groupFilter}
              onChange={(v) => setGroupFilter(v as "all" | NotificationGroup)}
              options={[
                { value: "all", label: "Tudo" },
                ...groups.map((g) => ({ value: g.id, label: g.label })),
              ]}
            />
          )}
        </div>
        {!isReadOnly && all.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={isMarkingAllAsRead || isClearingAll}
                onClick={() => void markAllAsRead()}
              >
                {isMarkingAllAsRead && <Loader size="sm" variant="button" className="mr-2" />}
                Marcar todas como lidas
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isClearingAll || isMarkingAllAsRead}
              onClick={() => setConfirmClearOpen(true)}
            >
              Limpar tudo
            </Button>
          </div>
        )}
      </div>

      {isReadOnly && (
        <p className="text-sm text-muted-foreground">
          Estas são notificações de exemplo da conta de demonstração.
        </p>
      )}

      {visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={all.length === 0 ? "Nenhuma notificação" : "Nada neste filtro"}
          description={
            all.length === 0
              ? "Quando um cliente abrir ou aceitar uma proposta, pagar uma cobrança ou aceitar a entrega da obra, o aviso aparece aqui."
              : "Troque o filtro para ver as outras notificações."
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {visible.map((notification) => {
            const type = notification.type as NotificationType;
            const Icon = getNotificationIcon(type);
            const unread = !isNotificationRead(notification, viewer);
            const removing = clearingIds.includes(notification.id);
            return (
              <li key={notification.id} className="flex gap-3 p-4 hover:bg-muted/40">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 gap-3 text-left"
                  onClick={() => open(notification)}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      getNotificationIconClassName(type),
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("text-sm", unread ? "font-semibold" : "font-medium")}>
                        {notification.title}
                      </span>
                      {unread && (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Não lida"
                        />
                      )}
                    </span>
                    <span className="mt-0.5 block whitespace-pre-wrap break-words text-sm text-muted-foreground">
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatNotificationTime(notification.createdAt)}
                    </span>
                  </span>
                </button>
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title="Remover da minha lista"
                    aria-label="Remover da minha lista"
                    disabled={removing}
                    onClick={() => void remove(notification)}
                  >
                    {removing ? <Loader size="sm" variant="button" /> : <X className="h-4 w-4" />}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canLoadOlder && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => void loadOlder()} disabled={loadingOlder}>
            {loadingOlder && <Loader size="sm" variant="button" className="mr-2" />}
            Carregar anteriores
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={(value) => !isClearingAll && setConfirmClearOpen(value)}
        title="Limpar todas as notificações?"
        description="Todas as notificações saem da sua lista. As outras pessoas da equipe continuam com as delas."
        confirmLabel="Limpar tudo"
        pendingLabel="Limpando..."
        destructive
        isPending={isClearingAll}
        onConfirm={async () => {
          await clearAllNotifications();
          setOlder([]);
          setConfirmClearOpen(false);
        }}
      />
    </div>
  );
}
