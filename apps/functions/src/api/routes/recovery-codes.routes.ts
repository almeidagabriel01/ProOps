import { Router } from "express";
import {
  generateRecoveryCodesHandler,
  getRecoveryCodesStatusHandler,
  verifyRecoveryCodeHandler,
} from "../controllers/recovery-codes.controller";

const router = Router();

router.post("/generate", generateRecoveryCodesHandler);
router.get("/status", getRecoveryCodesStatusHandler);
router.post("/verify", verifyRecoveryCodeHandler);

export const recoveryCodesRoutes = router;
