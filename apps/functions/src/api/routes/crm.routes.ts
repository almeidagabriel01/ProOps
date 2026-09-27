import { Router } from "express";
import {
  convertLead,
  createLead,
  deleteLead,
  listLeads,
  updateLead,
} from "../controllers/leads.controller";
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from "../controllers/activities.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Por prefixo, nunca `router.use(gate)`: este router é montado em `/v1` junto
// dos demais, e um gate sem path fecharia a API inteira.
router.use("/leads", requirePlanCapability("crm"));
router.use("/activities", requirePlanCapability("crm"));

router.get("/leads", listLeads);
router.post("/leads", createLead);
router.post("/leads/:id/convert", convertLead);
router.put("/leads/:id", updateLead);
router.delete("/leads/:id", deleteLead);

router.get("/activities", listActivities);
router.post("/activities", createActivity);
router.put("/activities/:id", updateActivity);
router.delete("/activities/:id", deleteActivity);

export const crmRoutes = router;
