import { Router } from "express";
import {
  cancelProposalFiscalDocumentController,
  focusWebhookController,
  getFiscalConfig,
  getProposalFiscalDocumentController,
  retryProposalFiscalDocumentController,
  upsertFiscalConfig,
} from "../controllers/fiscal.controller";

const router = Router();
const publicRouter = Router();

router.get("/fiscal/config", getFiscalConfig);
router.put("/fiscal/config", upsertFiscalConfig);
router.get("/proposals/:id/fiscal-document", getProposalFiscalDocumentController);
router.post(
  "/proposals/:id/fiscal-document/retry",
  retryProposalFiscalDocumentController,
);
router.post(
  "/proposals/:id/fiscal-document/cancel",
  cancelProposalFiscalDocumentController,
);

publicRouter.post("/v1/fiscal/webhooks/focus", focusWebhookController);

export const fiscalRoutes = router;
export const publicFiscalRoutes = publicRouter;
