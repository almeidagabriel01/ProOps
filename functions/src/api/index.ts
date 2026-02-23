import { onRequest } from "firebase-functions/v2/https";
import express from "express";
import cors from "cors";
import { validateFirebaseIdToken } from "./middleware/auth";
import { CORS_OPTIONS } from "../deploymentConfig";
import { proxyImage } from "./controllers/proxy.controller";

import { coreRoutes } from "./routes/core.routes";
import { financeRoutes } from "./routes/finance.routes";
import { adminRoutes } from "./routes/admin.routes";
import { stripeRoutes, publicStripeRoutes } from "./routes/stripe.routes";
import { auxiliaryRoutes } from "./routes/auxiliary.routes";
import { internalRoutes } from "./routes/internal.routes";
import sharedProposalsRoutes from "./routes/shared-proposals.routes";
import { sharedTransactionsRoutes } from "./routes/shared-transactions.routes";
import notificationsRoutes from "./routes/notifications.routes";

const app = express();

// Logging middleware
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

app.use(cors({ origin: true }));
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Public routes (no authentication required)
app.get("/health", (req: express.Request, res: express.Response) => {
  res.send("OK");
});

// Proxy image - must be public for PDF generation
app.get("/v1/aux/proxy-image", proxyImage);

// Public Webhooks
import { whatsappRoutes } from "./routes/whatsapp.routes";
app.use("/webhooks/whatsapp", whatsappRoutes);

// Public Stripe Routes (Plans)
app.use("/v1/stripe", publicStripeRoutes);

// Protected routes - everything below requires authentication
app.use(validateFirebaseIdToken);

// Placeholder for routes - will be imported dynamically or added here
// app.use("/products", productRoutes);

// Routes
app.use("/v1", coreRoutes);
app.use("/v1", financeRoutes);
app.use("/v1/admin", adminRoutes);
app.use("/v1/stripe", stripeRoutes);
app.use("/v1/aux", auxiliaryRoutes);
app.use("/internal", internalRoutes);
app.use("/v1", sharedProposalsRoutes); // Rota pública para /v1/share/:token
app.use("/v1", sharedTransactionsRoutes); // Rota pública para /v1/share/transaction/:token
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
