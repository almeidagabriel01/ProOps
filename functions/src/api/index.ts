import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import { validateFirebaseIdToken } from "./middleware/auth";
import { CORS_OPTIONS } from "../deploymentConfig";
import { proxyImage } from "./controllers/proxy.controller";

const app = express();

// Logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

app.use(cors({ origin: true }));
app.use(express.json());

// Public routes (no authentication required)
app.get("/health", (req: express.Request, res: express.Response) => {
  res.send("OK");
});

// Proxy image - must be public for PDF generation
app.get("/v1/aux/proxy-image", proxyImage);

// Protected routes - everything below requires authentication
app.use(validateFirebaseIdToken);

// Placeholder for routes - will be imported dynamically or added here
// app.use("/products", productRoutes);

import { coreRoutes } from "./routes/core.routes";
import { financeRoutes } from "./routes/finance.routes";
import { adminRoutes } from "./routes/admin.routes";
import { stripeRoutes } from "./routes/stripe.routes";
import { auxiliaryRoutes } from "./routes/auxiliary.routes";
import sharedProposalsRoutes from "./routes/shared-proposals.routes";
import notificationsRoutes from "./routes/notifications.routes";

// Routes
app.use("/v1", coreRoutes);
app.use("/v1", financeRoutes);
app.use("/v1/admin", adminRoutes);
app.use("/v1/stripe", stripeRoutes);
app.use("/v1/aux", auxiliaryRoutes);
app.use("/v1", sharedProposalsRoutes); // Rota pública para /v1/share/:token
app.use("/v1/notifications", notificationsRoutes); // Rotas de notificações

app.get("/authenticated", (req: express.Request, res: express.Response) => {
  res.json({
    message: `Authenticated as ${req.user?.uid}`,
    user: req.user,
  });
});

export const api = onRequest(
  {
    ...CORS_OPTIONS,
    cors: false, // Disable platform-level CORS to use Express middleware
  },
  app,
);
