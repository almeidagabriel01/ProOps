import { Router } from "express";
import {
  verifyChallenge,
  handleWebhook,
} from "../controllers/whatsapp.controller";

const router = Router();

router.get("/", verifyChallenge);
router.post("/", handleWebhook);

export { router as whatsappRoutes };
