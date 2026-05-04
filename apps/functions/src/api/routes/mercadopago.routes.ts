import { Router } from "express";
import { validateFirebaseIdToken } from "../middleware/auth";
import {
  callbackOAuth,
  disconnectOAuth,
  getConnectionStatus,
  startOAuth,
} from "../controllers/mercadopago.controller";

const router = Router();

router.get("/mercadopago/status", validateFirebaseIdToken, getConnectionStatus);
router.get("/mercadopago/oauth/start", validateFirebaseIdToken, startOAuth);
router.post("/mercadopago/oauth/callback", validateFirebaseIdToken, callbackOAuth);
router.delete("/mercadopago/disconnect", validateFirebaseIdToken, disconnectOAuth);

export { router as mercadoPagoRoutes };
