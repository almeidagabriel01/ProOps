import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../init";
import {
  NotificationService,
  type NotificationViewer,
} from "../services/notification.service";
import { invalidateTenantAudience } from "../services/notification-audience";
import { resolveUserAndTenant } from "../../lib/auth-helpers";
import { resolveNotificationScopeFromRequest } from "../helpers/notification-scope";
import type { NotificationScope } from "../helpers/notification-scope";
import {
  NOTIFICATION_TYPES,
  type NotificationPreferences,
} from "../../shared/notification-catalog";

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

/**
 * Escopo e leitor da request. A pessoa da empresa vê só o que foi endereçado
 * a ela; o superadmin, no escopo do sistema ou vendo uma empresa pelo painel,
 * continua na visão da empresa inteira.
 */
async function resolveViewerScope(
  req: Request,
): Promise<{ scope: NotificationScope; viewer: NotificationViewer }> {
  const userId = req.user!.uid;
  const scope = await resolveNotificationScopeFromRequest(userId, req.user!, {
    scopeKind: req.query.scopeKind,
    targetTenantId: req.query.targetTenantId,
  });
  const perRecipient = scope.kind === "tenant" && req.user!.isSuperAdmin !== true;
  return { scope, viewer: { uid: userId, perRecipient } };
}

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { scope, viewer } = await resolveViewerScope(req);

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === "true";

    const notifications = await NotificationService.getNotifications(scope, viewer, {
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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "ID da notificacao e obrigatorio" });
    }

    const { scope, viewer } = await resolveViewerScope(req);
    await NotificationService.markAsRead(id, scope, viewer);

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
    const { scope, viewer } = await resolveViewerScope(req);
    const count = await NotificationService.getUnreadCount(scope, viewer);

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
    const { scope, viewer } = await resolveViewerScope(req);
    await NotificationService.markAllAsRead(scope, viewer);

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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "ID da notificacao e obrigatorio" });
    }

    const { scope, viewer } = await resolveViewerScope(req);
    await NotificationService.deleteNotification(id, scope, viewer);

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
    const { scope, viewer } = await resolveViewerScope(req);
    await NotificationService.clearAllNotifications(scope, viewer);

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

const channelSchema = z
  .object({ inApp: z.boolean().optional(), email: z.boolean().optional() })
  .strict();

const preferencesSchema = z
  .object({
    preferences: z
      .record(z.string(), channelSchema)
      .refine(
        (value) => Object.keys(value).every((key) => (NOTIFICATION_TYPES as readonly string[]).includes(key)),
        { message: "Tipo de notificação inválido." },
      ),
  })
  .strict();

function readPreferences(userData: Record<string, unknown> | null | undefined): NotificationPreferences {
  const prefs = (userData?.preferences as { notifications?: NotificationPreferences } | undefined)
    ?.notifications;
  return prefs && typeof prefs === "object" ? prefs : {};
}

/** GET /v1/notifications/preferences: o que a pessoa escolheu (os padrões moram no catálogo). */
export const getPreferences = async (req: Request, res: Response) => {
  try {
    const snap = await db.collection("users").doc(req.user!.uid).get();
    return res.status(200).json({ preferences: readPreferences(snap.data()) });
  } catch (error) {
    console.error("Error getting notification preferences:", error);
    return handleNotificationError(error, res);
  }
};

/**
 * PUT /v1/notifications/preferences: grava por cima só os tipos enviados.
 * As preferências são da pessoa, não da empresa: cada membro escolhe as suas.
 */
export const updatePreferences = async (req: Request, res: Response) => {
  try {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.issues[0]?.message ?? "Preferências inválidas.",
      });
    }

    const userRef = db.collection("users").doc(req.user!.uid);
    const merged = await db.runTransaction(async (t) => {
      const snap = await t.get(userRef);
      const current = readPreferences(snap.data());
      const next: NotificationPreferences = { ...current };
      for (const [type, channel] of Object.entries(parsed.data.preferences)) {
        next[type as keyof NotificationPreferences] = {
          ...current[type as keyof NotificationPreferences],
          ...channel,
        };
      }
      t.update(userRef, { "preferences.notifications": next });
      return next;
    });

    if (req.user!.tenantId) invalidateTenantAudience(req.user!.tenantId);
    return res.status(200).json({ preferences: merged });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    return handleNotificationError(error, res);
  }
};
