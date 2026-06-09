import { Router } from "express";
import {
  generateRecoveryCodesHandler,
  getRecoveryCodesStatusHandler,
  reconcileRecoveryCodesHandler,
  verifyRecoveryCodeHandler,
} from "../controllers/recovery-codes.controller";

const router = Router();

router.post("/generate", generateRecoveryCodesHandler);
router.get("/status", getRecoveryCodesStatusHandler);
router.post("/verify", verifyRecoveryCodeHandler);
router.post("/reconcile", reconcileRecoveryCodesHandler);

export const recoveryCodesRoutes = router;
