import { Router } from "express";
import { validateFirebaseIdToken } from "../middleware/auth";
import {
  getFiscalSettingsHandler,
  saveFiscalSettingsHandler,
  lookupCnpjHandler,
  registerIssuerHandler,
} from "../controllers/fiscal.controller";

const router = Router();

router.get("/fiscal/settings", validateFirebaseIdToken, getFiscalSettingsHandler);
router.put("/fiscal/settings", validateFirebaseIdToken, saveFiscalSettingsHandler);
router.get("/fiscal/cnpj/:cnpj", validateFirebaseIdToken, lookupCnpjHandler);
router.post("/fiscal/issuer", validateFirebaseIdToken, registerIssuerHandler);

export { router as fiscalRoutes };
