import { Router } from "express";
import { validateFirebaseIdToken } from "../middleware/auth";
import {
  connectAsaas,
  getAsaasStatus,
  disconnectAsaas,
  updateAsaasPayout,
  retryAsaasWebhook,
} from "../controllers/asaas.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Asaas segue o modulo financeiro em vez de ter capacidade propria: payout e
// conciliacao vivem sobre lancamentos e carteiras, entao liberar o gateway a
// quem nao tem financeiro entregaria uma forma de receber sem onde registrar
// o dinheiro.
router.use("/asaas", requirePlanCapability("financial"));

router.post("/asaas/connect", validateFirebaseIdToken, connectAsaas);
router.get("/asaas/status", validateFirebaseIdToken, getAsaasStatus);
router.delete("/asaas/disconnect", validateFirebaseIdToken, disconnectAsaas);
router.put("/asaas/payout", validateFirebaseIdToken, updateAsaasPayout);
router.post("/asaas/webhook/retry", validateFirebaseIdToken, retryAsaasWebhook);

export { router as asaasRoutes };
