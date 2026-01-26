import { Router } from "express";
import { validateFirebaseIdToken as authenticate } from "../middleware/auth";
import * as NotificationsController from "../controllers/notifications.controller";

const router = Router();

// Todas as rotas de notificações requerem autenticação
router.use(authenticate);

/**
 * GET /v1/notifications - Lista notificações
 * Query params: limit, offset, unreadOnly
 */
router.get("/", NotificationsController.getNotifications);

/**
 * GET /v1/notifications/unread-count - Contador de não lidas
 */
router.get("/unread-count", NotificationsController.getUnreadCount);

/**
 * PUT /v1/notifications/:id/read - Marca como lida
 */
router.put("/:id/read", NotificationsController.markAsRead);

/**
 * PUT /v1/notifications/mark-all-read - Marca todas como lidas
 */
router.put("/mark-all-read", NotificationsController.markAllAsRead);

export default router;
