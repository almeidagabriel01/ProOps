import { Router } from "express";
import {
  challengeWhatsappLogin,
  disableWhatsappMfa,
  startWhatsappEnroll,
  verifyWhatsappEnroll,
  verifyWhatsappLogin,
} from "../controllers/whatsapp-mfa.controller";

const router = Router();

router.post("/enroll/start", startWhatsappEnroll);
router.post("/enroll/verify", verifyWhatsappEnroll);
router.post("/challenge", challengeWhatsappLogin);
router.post("/verify", verifyWhatsappLogin);
router.post("/disable", disableWhatsappMfa);

export const whatsappMfaRoutes = router;
