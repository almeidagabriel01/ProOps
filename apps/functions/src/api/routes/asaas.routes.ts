import { Router } from "express";
import { validateFirebaseIdToken } from "../middleware/auth";
import { connectAsaas, getAsaasStatus, disconnectAsaas } from "../controllers/asaas.controller";

const router = Router();

router.post("/asaas/connect", validateFirebaseIdToken, connectAsaas);
router.get("/asaas/status", validateFirebaseIdToken, getAsaasStatus);
router.delete("/asaas/disconnect", validateFirebaseIdToken, disconnectAsaas);

export { router as asaasRoutes };
