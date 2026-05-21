import { Router } from "express";
import {
  requestEmailVerification,
  requestPasswordReset,
} from "../controllers/auth.controller";

const publicRouter = Router();
publicRouter.post("/forgot-password", requestPasswordReset);

const protectedRouter = Router();
protectedRouter.post("/send-verification", requestEmailVerification);

export const publicAuthRoutes = publicRouter;
export const protectedAuthRoutes = protectedRouter;
