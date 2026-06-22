import { Router } from "express";
import {
  requestEmailVerification,
  requestPasswordReset,
} from "../controllers/auth.controller";
import { recoverTotpWithCode } from "../controllers/recovery-codes.controller";
import {
  checkWhatsappLoginFallback,
  sendWhatsappLoginFallback,
  verifyWhatsappLoginFallback,
} from "../controllers/whatsapp-login-fallback.controller";

const publicRouter = Router();
publicRouter.post("/forgot-password", requestPasswordReset);
publicRouter.post("/mfa-recovery/recover-totp", recoverTotpWithCode);
publicRouter.post(
  "/mfa-recovery/whatsapp/availability",
  checkWhatsappLoginFallback,
);
publicRouter.post("/mfa-recovery/whatsapp/send", sendWhatsappLoginFallback);
publicRouter.post("/mfa-recovery/whatsapp/verify", verifyWhatsappLoginFallback);

const protectedRouter = Router();
protectedRouter.post("/send-verification", requestEmailVerification);

export const publicAuthRoutes = publicRouter;
export const protectedAuthRoutes = protectedRouter;
