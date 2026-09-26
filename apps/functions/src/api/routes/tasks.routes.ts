import { Router } from "express";
import {
  createTask,
  deleteTask,
  listTaskPeople,
  updateTask,
} from "../controllers/tasks.controller";

/**
 * Tarefas: todos os planos, então sem `requirePlanCapability`. A permissão de
 * membro (pageId `tasks`) é conferida no controller. `/tasks/people` antes de
 * `/tasks/:id`: o Express casa por ordem.
 */
const router = Router();

router.get("/tasks/people", listTaskPeople);
router.post("/tasks", createTask);
router.put("/tasks/:id", updateTask);
router.delete("/tasks/:id", deleteTask);

export const tasksRoutes = router;
