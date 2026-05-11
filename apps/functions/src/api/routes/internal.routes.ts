import { Router } from "express";
import {
  reportWhatsappOverageManual,
  migrateWhatsAppAddons,
  checkPriceChangesManual,
  reconcileAddonsManual,
} from "../controllers/internal.controller";

const router = Router();

router.post("/cron/whatsapp-overage-report", reportWhatsappOverageManual);
router.post("/cron/migrate-whatsapp-addons", migrateWhatsAppAddons);
router.post("/cron/check-price-changes", checkPriceChangesManual);
router.post("/cron/reconcile-addons", reconcileAddonsManual);

export { router as internalRoutes };
