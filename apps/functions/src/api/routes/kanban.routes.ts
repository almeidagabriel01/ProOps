import { Router } from "express";
import {
  createKanbanStatus,
  updateKanbanStatus,
  deleteKanbanStatus,
  reorderKanbanStatuses,
} from "../controllers/kanban.controller";
import { requirePlanCapability } from "../middleware/require-plan-capability";

const router = Router();

// Ate aqui estas 4 rotas nao tinham middleware nenhum, enquanto a UI dizia
// Enterprise, a Lia dizia Pro e o add-on era vendido a Starter e Pro — quatro
// regras para o mesmo modulo, e a REST nao aplicava nenhuma.
router.use("/kanban-statuses", requirePlanCapability("crm"));

// Kanban Status Columns
router.post("/kanban-statuses", createKanbanStatus);
router.put("/kanban-statuses/reorder", reorderKanbanStatuses);
router.put("/kanban-statuses/:id", updateKanbanStatus);
router.delete("/kanban-statuses/:id", deleteKanbanStatus);

export const kanbanRoutes = router;
