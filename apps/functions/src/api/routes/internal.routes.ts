import { Router } from "express";
import {
  reportWhatsappOverageManual,
  migrateWhatsAppAddons,
  checkPriceChangesManual,
} from "../controllers/internal.controller";

const router = Router();

router.post("/cron/whatsapp-overage-report", reportWhatsappOverageManual);
router.post("/cron/migrate-whatsapp-addons", migrateWhatsAppAddons);
router.post("/cron/check-price-changes", checkPriceChangesManual);

export { router as internalRoutes };
