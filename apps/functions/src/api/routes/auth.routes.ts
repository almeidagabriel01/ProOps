import { Router } from "express";
import {
  requestEmailVerification,
  requestPasswordReset,
} from "../controllers/auth.controller";
import { recoverTotpWithCode } from "../controllers/recovery-codes.controller";

const publicRouter = Router();
publicRouter.post("/forgot-password", requestPasswordReset);
publicRouter.post("/mfa-recovery/recover-totp", recoverTotpWithCode);

const protectedRouter = Router();
protectedRouter.post("/send-verification", requestEmailVerification);

export const publicAuthRoutes = publicRouter;
export const protectedAuthRoutes = protectedRouter;
