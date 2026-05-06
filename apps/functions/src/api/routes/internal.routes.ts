import { Router } from "express";
import {
  reportWhatsappOverageManual,
  migrateWhatsAppAddons,
} from "../controllers/internal.controller";

const router = Router();

router.post("/cron/whatsapp-overage-report", reportWhatsappOverageManual);
router.post("/cron/migrate-whatsapp-addons", migrateWhatsAppAddons);

export { router as internalRoutes };
