import { Request, Response } from "express";
import { logger } from "../../lib/logger";
import { loadTeamPeople } from "../services/team-people";

/**
 * GET /v1/team/people: as pessoas da empresa, para escolher o responsável por
 * um cliente ou por uma venda. Todos os planos e qualquer pessoa da equipe:
 * a resposta é só id e nome. O tenant vem de `req.user.tenantId`.
 */
export async function listTeamPeople(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(403).json({ message: "Tenant não identificado." });
    return res.json({ people: await loadTeamPeople(tenantId) });
  } catch (error) {
    logger.error("team_people_failed", { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ message: "Erro ao carregar a equipe." });
  }
}
