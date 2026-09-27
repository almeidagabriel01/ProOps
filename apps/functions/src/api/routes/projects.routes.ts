import { Router } from "express";
import {
  addChecklistItem,
  createDeliveryLink,
  createProject,
  deleteChecklistItem,
  deleteProject,
  deleteStagePhoto,
  getProjectSettings,
  listProjectAssignees,
  toggleChecklistItem,
  updateProject,
  updateProjectSettings,
  updateStage,
  uploadStagePhoto,
} from "../controllers/projects.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Por prefixo, nunca `router.use(gate)`: este router é montado em `/v1` junto
// dos demais, e um gate sem path fecharia a API inteira.
router.use("/projects", requirePlanCapability("projects"));

// `/settings` antes de `/:id`: o Express casa por ordem, e `PUT /projects/settings`
// cairia no update de um projeto com id "settings".
router.get("/projects/settings", getProjectSettings);
router.get("/projects/assignees", listProjectAssignees);
router.put("/projects/settings", updateProjectSettings);

router.post("/projects", createProject);
router.put("/projects/:id", updateProject);
router.delete("/projects/:id", deleteProject);
router.post("/projects/:id/delivery-link", createDeliveryLink);

router.put("/projects/:id/stages/:stageId", updateStage);
router.post("/projects/:id/stages/:stageId/checklist", addChecklistItem);
router.put("/projects/:id/stages/:stageId/checklist/:itemId", toggleChecklistItem);
router.delete("/projects/:id/stages/:stageId/checklist/:itemId", deleteChecklistItem);
router.post("/projects/:id/stages/:stageId/photos", uploadStagePhoto);
router.delete("/projects/:id/stages/:stageId/photos/:photoId", deleteStagePhoto);

export const projectsRoutes = router;
