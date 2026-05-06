import { Router } from "express";
import {
  verifyChallenge,
  handleWebhook,
  getWhatsAppInfo,
} from "../controllers/whatsapp.controller";
import { validateFirebaseIdToken } from "../middleware/auth";

const router = Router();

router.get("/", verifyChallenge);
router.post("/", handleWebhook);

// Protected route — requires Firebase ID token
router.get("/info", validateFirebaseIdToken, getWhatsAppInfo);

export { router as whatsappRoutes };
