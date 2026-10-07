import { Router } from "express";
import { listTeamPeople } from "../controllers/team.controller";
import { reportAuditEvent } from "../controllers/member-access.controller";

const router = Router();

// Sem gate de plano: o responsável pelo cliente vale em todos os planos.
router.get("/team/people", listTeamPeople);
// O que só acontece no navegador e entra no histórico da equipe (a exportação).
router.post("/audit/events", reportAuditEvent);

export const teamRoutes = router;
