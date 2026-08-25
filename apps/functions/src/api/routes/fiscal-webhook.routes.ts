import { Router } from "express";
import { handleFocusWebhook } from "../controllers/fiscal-webhook.controller";

const router = Router();

// O segredo faz parte da URL porque o Focus nao envia cabecalho de
// autenticacao — a propria URL e a credencial.
router.post("/:tenantId/:secret/:type", handleFocusWebhook);

export { router as fiscalWebhookRoutes };
