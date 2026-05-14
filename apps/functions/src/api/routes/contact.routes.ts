import { Router } from "express";
import { submitContactForm } from "../controllers/contact.controller";

const router = Router();
router.post("/contact-form", submitContactForm);
export const contactRoutes = router;
