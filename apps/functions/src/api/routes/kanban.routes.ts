import { Router } from "express";
import {
  createKanbanStatus,
  updateKanbanStatus,
  deleteKanbanStatus,
  reorderKanbanStatuses,
} from "../controllers/kanban.controller";

const router = Router();

// Kanban Status Columns
router.post("/kanban-statuses", createKanbanStatus);
router.put("/kanban-statuses/reorder", reorderKanbanStatuses);
router.put("/kanban-statuses/:id", updateKanbanStatus);
router.delete("/kanban-statuses/:id", deleteKanbanStatus);

export const kanbanRoutes = router;
