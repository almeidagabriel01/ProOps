import { Router } from "express";
import {
  requestEmailVerification,
  requestPasswordReset,
} from "../controllers/auth.controller";
import {
  confirmMfaRecovery,
  inspectMfaRecoveryToken,
  requestMfaRecovery,
} from "../controllers/mfa-recovery.controller";

const publicRouter = Router();
publicRouter.post("/forgot-password", requestPasswordReset);
publicRouter.post("/forgot-mfa", requestMfaRecovery);
publicRouter.post("/mfa-recovery/inspect", inspectMfaRecoveryToken);
publicRouter.post("/mfa-recovery/confirm", confirmMfaRecovery);

const protectedRouter = Router();
protectedRouter.post("/send-verification", requestEmailVerification);

export const publicAuthRoutes = publicRouter;
export const protectedAuthRoutes = protectedRouter;
