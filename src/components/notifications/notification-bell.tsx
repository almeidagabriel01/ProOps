"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, Clock, FileText, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";
import { useTenant } from "@/providers/tenant-provider";
import { Notification, NotificationType } from "@/types/notification";
import { formatDateBR } from "@/utils/date-format";

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case NotificationType.TRANSACTION_DUE_REMINDER:
      return Clock;
    case NotificationType.PROPOSAL_EXPIRING:
      return AlertTriangle;
    default:
      return FileText;
  }
}

function getNotificationLink(notification: Notification): string | undefined {
  switch (notification.type) {
    case NotificationType.TRANSACTION_DUE_REMINDER:
    case NotificationType.TRANSACTION_VIEWED:
      return "/transactions";
    case NotificationType.PROPOSAL_EXPIRING:
      return notification.proposalId
        ? `/proposals/${notification.proposalId}/view`
        : "/proposals";
    default:
      return notification.proposalId
        ? `/proposals/${notification.proposalId}/view`
        : undefined;
  }
}

function NotificationListSkeleton() {
  return (
    <div className="p-6 space-y-3">
      {[0, 1].map((item) => (
        <div key={item} className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            <div className="h-3 w-full rounded bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const { isGlobalLoading } = useTenant();
  const {
    scopeKey,
    notifications,
    unreadCount,
    isLoading: isNotifsLoading,
    isMarkingAllAsRead,
    isClearingAll,
    clearingIds,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllNotifications,
  } = useNotifications();

  React.useEffect(() => {
    setExpandedIds(new Set());
  }, [scopeKey]);

  const showLoadingState = isGlobalLoading || isNotifsLoading;

  const handleNotificationClick = async (
    notification: Notification,
    linkHref?: string,
  ) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    if (linkHref) {
      router.push(linkHref);
      return;
    }

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(notification.id)) {
        next.delete(notification.id);
      } else {
        next.add(notification.id);
      }
      return next;
    });
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "agora";
      if (diffMins < 60) return `ha ${diffMins}min`;
      if (diffHours < 24) return `ha ${diffHours}h`;
      if (diffDays < 7) return `ha ${diffDays}d`;
      return formatDateBR(date);
    } catch {
      return "";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Notificacoes"
        >
          <Bell className="w-5 h-5 transition-opacity opacity-100" />
          {!showLoadingState && unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[24rem] p-0">
        <div className="p-3 border-b space-y-2">
          <h3 className="font-semibold">Notificacoes</h3>
          {!showLoadingState && notifications.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isMarkingAllAsRead || isClearingAll}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    markAllAsRead();
                  }}
                  className="text-xs h-7 px-2"
                >
                  {isMarkingAllAsRead ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Marcando...
                    </>
                  ) : (
                    "Marcar todas como lidas"
                  )}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                disabled={isClearingAll || isMarkingAllAsRead}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  clearAllNotifications();
                }}
                className="text-xs h-7 px-2"
              >
                {isClearingAll ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  "Limpar tudo"
                )}
              </Button>
            </div>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {showLoadingState ? (
            <NotificationListSkeleton />
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              Nenhuma notificacao
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = getNotificationIcon(
                notification.type as NotificationType,
              );
              const linkHref = getNotificationLink(notification);
              const isExpanded = expandedIds.has(notification.id);
              const canExpand = notification.message.length > 120;

              return (
                <div
                  key={notification.id}
                  className="flex gap-3 p-3 hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() =>
                      handleNotificationClick(notification, linkHref)
                    }
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
                          <Icon className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <div className="w-2 h-2 rounded-full bg-foreground/60 flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p
                          className={`text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap break-words ${
                            isExpanded ? "" : "line-clamp-2"
                          }`}
                        >
                          {notification.message}
                        </p>
                        {!linkHref && canExpand && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground mt-1"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setExpandedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(notification.id)) {
                                  next.delete(notification.id);
                                } else {
                                  next.add(notification.id);
                                }
                                return next;
                              });
                            }}
                          >
                            {isExpanded ? "Ver menos" : "Ver mensagem completa"}
                          </button>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 mt-0.5"
                    title="Remover notificacao"
                    disabled={clearingIds.includes(notification.id)}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      clearNotification(notification.id);
                    }}
                  >
                    {clearingIds.includes(notification.id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
