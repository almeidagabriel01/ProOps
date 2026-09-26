import { Router } from "express";
import {
  createClientPortalLink,
  getClientPortalLink,
  getPublicClientPortal,
  openPublicClientPortalItem,
  revokeClientPortalLink,
  rotateClientPortalLink,
} from "../controllers/client-portal.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

/**
 * Rotas da empresa, montadas em `/v1` com as demais. Gate por prefixo, nunca
 * `router.use(gate)` sem path.
 */
const router = Router();
router.use("/client-portal", requirePlanCapability("clientPortal"));
router.get("/client-portal/:clientId/link", getClientPortalLink);
router.post("/client-portal/:clientId/link", createClientPortalLink);
router.post("/client-portal/:clientId/link/rotate", rotateClientPortalLink);
router.delete("/client-portal/:clientId/link", revokeClientPortalLink);
export const clientPortalRoutes = router;

/**
 * Rotas públicas, montadas em `/v1/share/portal` ANTES da autenticação (que
 * libera `/v1/share/`). O plano é conferido pela empresa do token
 * (`resolvePortalToken`): não há usuário logado aqui.
 */
const publicRouter = Router();
publicRouter.get("/:token", getPublicClientPortal);
publicRouter.post("/:token/open", openPublicClientPortalItem);
export const publicClientPortalRoutes = publicRouter;
