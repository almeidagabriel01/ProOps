import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";
import { resolveUserAndTenant } from "../../lib/auth-helpers";

/**
 * GET /v1/notifications
 * Lista notificações do tenant com paginação
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;

    // Resolver tenant do usuário
    const { tenantId } = await resolveUserAndTenant(userId, req.user);

    // Parâmetros de paginação
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === "true";

    // Buscar notificações
    const notifications = await NotificationService.getNotifications(tenantId, {
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
    const message =
      error instanceof Error ? error.message : "Erro ao buscar notificações";
    return res.status(500).json({ message });
  }
};

/**
 * PUT /v1/notifications/:id/read
 * Marca uma notificação como lida
 */
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ message: "ID da notificação é obrigatório" });
    }

    // Resolver tenant do usuário
    const { tenantId } = await resolveUserAndTenant(userId, req.user);

    // Marcar como lida (serviço valida ownership)
    await NotificationService.markAsRead(id, tenantId);

    return res.status(200).json({
      success: true,
      message: "Notificação marcada como lida",
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: "Notificação não encontrada" });
    }

    const message =
      error instanceof Error ? error.message : "Erro ao marcar notificação";
    return res.status(500).json({ message });
  }
};

/**
 * GET /v1/notifications/unread-count
 * Retorna contador de notificações não lidas
 */
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;

    // Resolver tenant do usuário
    const { tenantId } = await resolveUserAndTenant(userId, req.user);

    // Buscar contador
    const count = await NotificationService.getUnreadCount(tenantId);

    return res.status(200).json({
      success: true,
      unreadCount: count,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao contar notificações";
    return res.status(500).json({ message });
  }
};

/**
 * PUT /v1/notifications/mark-all-read
 * Marca todas as notificações como lidas
 */
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;

    // Resolver tenant do usuário
    const { tenantId } = await resolveUserAndTenant(userId, req.user);

    // Marcar todas como lidas
    await NotificationService.markAllAsRead(tenantId);

    return res.status(200).json({
      success: true,
      message: "Todas as notificações foram marcadas como lidas",
    });
  } catch (error) {
    console.error("Error marking all as read:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao marcar notificações";
    return res.status(500).json({ message });
  }
};
