import { Router } from "express";
import { reportWhatsappOverageManual } from "../controllers/internal.controller";

const router = Router();

router.post("/cron/whatsapp-overage-report", reportWhatsappOverageManual);

export { router as internalRoutes };
