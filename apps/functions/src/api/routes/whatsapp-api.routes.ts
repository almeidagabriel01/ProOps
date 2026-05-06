import { Router } from "express";
import { getWhatsAppInfo } from "../controllers/whatsapp.controller";

const router = Router();

router.get("/info", getWhatsAppInfo);

export { router as whatsappApiRoutes };
