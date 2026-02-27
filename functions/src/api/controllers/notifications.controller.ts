import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service";
import { resolveUserAndTenant } from "../../lib/auth-helpers";

const DUE_TOAST_TYPES = [
  "transaction_due_reminder",
  "proposal_expiring",
] as const;

type DueToastType = (typeof DUE_TOAST_TYPES)[number];

/**
 * GET /v1/notifications
 * Lista notificações do tenant com paginação
 */
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;

    // Resolver tenant do usuário
    const { tenantId: userTenantId, isSuperAdmin } = await resolveUserAndTenant(userId, req.user);
    const targetTenantId = req.query.targetTenantId as string;

    // Parâmetros de paginação
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === "true";

    let effectiveTenantId = userTenantId;
    let includeSystem = isSuperAdmin;

    // Se é Super Admin e está vendo outro tenant, usa o ID desse tenant e NÃO mostra notificações do sistema
    if (isSuperAdmin && targetTenantId && targetTenantId !== userTenantId) {
      effectiveTenantId = targetTenantId;
      includeSystem = false;
    }

    // Buscar notificações
    const notifications = await NotificationService.getNotifications(effectiveTenantId, {
      limit,
      offset,
      unreadOnly,
      isSuperAdmin: includeSystem,
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
    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    // Marcar como lida (serviço valida ownership)
    await NotificationService.markAsRead(id, tenantId, isSuperAdmin);

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
    const targetTenantId = req.query.targetTenantId as string;

    let { tenantId, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    let includeSystem = isSuperAdmin;
    if (isSuperAdmin && targetTenantId) {
      tenantId = targetTenantId;
      includeSystem = false;
    }

    // Marcar todas como lidas
    await NotificationService.markAllAsRead(tenantId, includeSystem);

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

/**
 * DELETE /v1/notifications/:id
 * Remove uma notificação
 */
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ message: "ID da notificação é obrigatório" });
    }

    const { tenantId, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    await NotificationService.deleteNotification(id, tenantId, isSuperAdmin);

    return res.status(200).json({
      success: true,
      message: "Notificação removida com sucesso",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: "Notificação não encontrada" });
    }

    const message =
      error instanceof Error ? error.message : "Erro ao remover notificação";
    return res.status(500).json({ message });
  }
};

/**
 * DELETE /v1/notifications/clear-all
 * Remove todas as notificações do tenant
 */
export const clearAllNotifications = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const targetTenantId = req.query.targetTenantId as string;

    let { tenantId, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
    );

    let includeSystem = isSuperAdmin;
    if (isSuperAdmin && targetTenantId) {
      tenantId = targetTenantId;
      includeSystem = false;
    }

    console.log(`[clearAllNotifications] User: ${userId}, Tenant: ${tenantId}, IsSuperAdmin: ${isSuperAdmin}, TargetTenant: ${targetTenantId}`);

    if (!tenantId) {
      console.warn(`[clearAllNotifications] Missing tenantId for user ${userId}`);
      return res.status(400).json({ message: "Tenant ID não identificado" });
    }

    await NotificationService.clearAllNotifications(tenantId, includeSystem);

    return res.status(200).json({
      success: true,
      message: "Todas as notificações foram removidas",
    });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao limpar notificações";
    return res.status(500).json({ message });
  }
};

/**
 * POST /v1/notifications/due-toast/claim
 * Faz claim atômico de exibição diária por tenant+tipo.
 */
export const claimDailyDueToast = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { type } = req.body as { type?: string };

    if (!type || !DUE_TOAST_TYPES.includes(type as DueToastType)) {
      return res.status(400).json({
        message:
          "Tipo inválido. Use 'transaction_due_reminder' ou 'proposal_expiring'.",
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
    const message =
      error instanceof Error ? error.message : "Erro ao validar toast diário";
    return res.status(500).json({ message });
  }
};
