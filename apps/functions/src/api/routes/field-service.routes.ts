import { Router } from "express";
import {
  changeServiceOrderStatus,
  completeServiceOrder,
  createEquipment,
  createServiceOrder,
  deleteEquipment,
  deleteServiceOrder,
  deleteServiceOrderPhoto,
  listTechnicians,
  reopenServiceOrder,
  updateEquipment,
  updateServiceOrder,
  uploadServiceOrderPhoto,
} from "../controllers/field-service.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Por prefixo, nunca `router.use(gate)`: este router é montado em `/v1` junto
// dos demais, e um gate sem path fecharia a API inteira.
const gate = requirePlanCapability("fieldService");
router.use("/equipment", gate);
router.use("/service-orders", gate);

router.post("/equipment", createEquipment);
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

export const fieldServiceRoutes = router;
