import { Router } from "express";
import { handleAsaasWebhook } from "../controllers/asaas-webhook.controller";

const router = Router();

router.post("/:tenantId", handleAsaasWebhook);

export { router as asaasWebhookRoutes };
