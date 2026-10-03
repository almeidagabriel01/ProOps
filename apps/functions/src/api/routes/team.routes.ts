import { Router } from "express";
import { listTeamPeople } from "../controllers/team.controller";

const router = Router();

// Sem gate de plano: o responsável pelo cliente vale em todos os planos.
router.get("/team/people", listTeamPeople);

export const teamRoutes = router;
