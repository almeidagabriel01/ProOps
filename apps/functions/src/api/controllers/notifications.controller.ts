import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { resolveNotificationScopeFromRequest } from "../helpers/notification-scope";

const DUE_TOAST_TYPES = [
  "transaction_due_reminder",
  "proposal_expiring",
] as const;

type DueToastType = (typeof DUE_TOAST_TYPES)[number];

function handleNotificationError(error: unknown, res: Response) {
  if (error instanceof Error) {
    if (
      error.message.includes("FORBIDDEN_NOTIFICATION_SCOPE") ||
      error.message.includes("Unauthorized")
    ) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    if (error.message.includes("NOTIFICATION_SCOPE_TENANT_REQUIRED")) {
      return res.status(400).json({ message: "Escopo de notificacao invalido" });
    }

    if (error.message.includes("not found")) {
      return res.status(404).json({ message: "Notificacao nao encontrada" });
    }
  }

  const message = error instanceof Error ? error.message : "Erro interno";
  return res.status(500).json({ message });
}

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const scope = await resolveNotificationScopeFromRequest(userId, req.user!, {
      scopeKind: req.query.scopeKind,
      targetTenantId: req.query.targetTenantId,
    });

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === "true";

    const notifications = await NotificationService.getNotifications(scope, {
      limit,
      offset,
      unreadOnly,
    });

    return res.status(200).json({
      success: true,
      notifications,
      pagination: {
        limit,
        offset,
        count: notifications.length,
      },
    });
  } catch (error) {
    console.error("Error getting notifications:", error);
    return handleNotificationError(error, res);
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "ID da notificacao e obrigatorio" });
    }

    const scope = await resolveNotificationScopeFromRequest(userId, req.user!, {
      scopeKind: req.query.scopeKind,
      targetTenantId: req.query.targetTenantId,
    });

    await NotificationService.markAsRead(id, scope);

    return res.status(200).json({
      success: true,
      message: "Notificacao marcada como lida",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return handleNotificationError(error, res);
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const scope = await resolveNotificationScopeFromRequest(userId, req.user!, {
      scopeKind: req.query.scopeKind,
      targetTenantId: req.query.targetTenantId,
    });

    const count = await NotificationService.getUnreadCount(scope);

    return res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    return handleNotificationError(error, res);
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const scope = await resolveNotificationScopeFromRequest(userId, req.user!, {
      scopeKind: req.query.scopeKind,
      targetTenantId: req.query.targetTenantId,
    });

    await NotificationService.markAllAsRead(scope);

    return res.status(200).json({
      success: true,
      message: "Todas as notificacoes foram marcadas como lidas",
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    return handleNotificationError(error, res);
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "ID da notificacao e obrigatorio" });
    }

    const scope = await resolveNotificationScopeFromRequest(userId, req.user!, {
      scopeKind: req.query.scopeKind,
      targetTenantId: req.query.targetTenantId,
    });

    await NotificationService.deleteNotification(id, scope);

    return res.status(200).json({
      success: true,
      message: "Notificacao removida com sucesso",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return handleNotificationError(error, res);
  }
};

export const clearAllNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const scope = await resolveNotificationScopeFromRequest(userId, req.user!, {
      scopeKind: req.query.scopeKind,
      targetTenantId: req.query.targetTenantId,
    });

    await NotificationService.clearAllNotifications(scope);

    return res.status(200).json({
      success: true,
      message: "Todas as notificacoes foram removidas",
    });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    return handleNotificationError(error, res);
  }
};

export const claimDailyDueToast = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { type } = req.body as { type?: string };

    if (!type || !DUE_TOAST_TYPES.includes(type as DueToastType)) {
      return res.status(400).json({
        message:
          "Tipo invalido. Use 'transaction_due_reminder' ou 'proposal_expiring'.",
      });
    }

    const { tenantId } = await resolveUserAndTenant(userId, req.user);
    const shouldShow = await NotificationService.claimDailyDueToast(
      tenantId,
      type as DueToastType,
      userId,
    );

    return res.status(200).json({
      success: true,
      shouldShow,
    });
  } catch (error) {
    console.error("Error claiming daily due toast:", error);
    return handleNotificationError(error, res);
  }
};
