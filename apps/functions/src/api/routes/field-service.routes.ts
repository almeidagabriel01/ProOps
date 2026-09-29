import { Router } from "express";
import {
  changeServiceOrderStatus,
  completeServiceOrder,
  createEquipment,
  createEquipmentBatch,
  createServiceOrder,
  deleteEquipment,
  deleteServiceOrder,
  createServiceOrderShareLink,
  deleteServiceOrderPhoto,
  downloadServiceOrderPdf,
  getSharedServiceOrder,
  launchServiceOrderTransaction,
  listTechnicians,
  reopenServiceOrder,
  updateEquipment,
  updateServiceOrder,
  uploadServiceOrderPhoto,
} from "../controllers/field-service.controller";
import {
  activateServiceContract,
  createServiceContract,
  deleteServiceContract,
  endServiceContract,
  resumeServiceContract,
  suspendServiceContract,
  updateServiceContract,
} from "../controllers/service-contracts.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";
import { pdfRateLimiter } from "../middleware/pdf-rate-limiter";

const router = Router();

// Por prefixo, nunca `router.use(gate)`: este router é montado em `/v1` junto
// dos demais, e um gate sem path fecharia a API inteira.
const gate = requirePlanCapability("fieldService");
router.use("/equipment", gate);
router.use("/service-orders", gate);
router.use("/service-contracts", gate);

router.post("/equipment", createEquipment);
// `/batch` antes de `/:id`: o Express casa por ordem.
router.post("/equipment/batch", createEquipmentBatch);
router.put("/equipment/:id", updateEquipment);
router.delete("/equipment/:id", deleteEquipment);

// `/technicians` antes de `/:id`: o Express casa por ordem.
router.get("/service-orders/technicians", listTechnicians);
router.post("/service-orders", createServiceOrder);
router.put("/service-orders/:id", updateServiceOrder);
router.delete("/service-orders/:id", deleteServiceOrder);
router.post("/service-orders/:id/status", changeServiceOrderStatus);
router.post("/service-orders/:id/complete", completeServiceOrder);
router.post("/service-orders/:id/reopen", reopenServiceOrder);
router.post("/service-orders/:id/photos", uploadServiceOrderPhoto);
router.delete("/service-orders/:id/photos/:photoId", deleteServiceOrderPhoto);
router.post("/service-orders/:id/share-link", createServiceOrderShareLink);
router.post("/service-orders/:id/transaction", launchServiceOrderTransaction);
// Fallback: o proxy manda os caminhos terminados em /pdf para a função `pdf`.
router.get("/service-orders/:id/pdf", pdfRateLimiter, downloadServiceOrderPdf);

router.post("/service-contracts", createServiceContract);
router.put("/service-contracts/:id", updateServiceContract);
router.delete("/service-contracts/:id", deleteServiceContract);
router.post("/service-contracts/:id/activate", activateServiceContract);
router.post("/service-contracts/:id/suspend", suspendServiceContract);
router.post("/service-contracts/:id/resume", resumeServiceContract);
router.post("/service-contracts/:id/end", endServiceContract);

export const fieldServiceRoutes = router;

/** Pública: o token é a credencial. Montada antes da autenticação, sob /v1/share. */
const publicRouter = Router();
publicRouter.get("/share/service-order/:token", getSharedServiceOrder);
export const publicFieldServiceRoutes = publicRouter;
