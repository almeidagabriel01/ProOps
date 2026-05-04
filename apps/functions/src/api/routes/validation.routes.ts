import { Router } from "express";
import { validateContactForSignup } from "../controllers/validation.controller";

const router = Router();

router.post("/contact", validateContactForSignup);

export const validationRoutes = router;
