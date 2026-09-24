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

// Dois gates, em ordem. O financeiro porque payout e conciliacao vivem sobre
// lancamentos e carteiras: liberar o gateway a quem nao tem financeiro
// entregaria uma forma de receber sem onde registrar o dinheiro. O pagamento
// online porque, desde 2026-09, ele e nativo so no Enterprise e vendido como
// add-on no Starter e no Pro.
router.use("/asaas", requirePlanCapability("financial"));
router.use("/asaas", requirePlanCapability("onlinePayments"));

router.post("/asaas/connect", validateFirebaseIdToken, connectAsaas);
router.get("/asaas/status", validateFirebaseIdToken, getAsaasStatus);
router.delete("/asaas/disconnect", validateFirebaseIdToken, disconnectAsaas);
router.put("/asaas/payout", validateFirebaseIdToken, updateAsaasPayout);
router.post("/asaas/webhook/retry", validateFirebaseIdToken, retryAsaasWebhook);

export { router as asaasRoutes };
