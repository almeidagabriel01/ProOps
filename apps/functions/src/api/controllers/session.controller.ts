import type { Request, Response } from "express";
import { recordTenantLastSeen } from "../../lib/tenant-last-seen";
import { logger } from "../../lib/logger";

/**
 * `POST /v1/session/ping` — a plataforma abriu autenticada.
 *
 * O frontend chama isto uma vez por sessao do navegador (login novo ou sessao
 * que ja existia) e de novo no primeiro acesso de cada dia. E o que alimenta o
 * "Ultima vez online" do painel do super admin.
 *
 * Precisa estar liberado para conta GRATUITA: a pergunta que originou isto e
 * justamente "a empresa que criou a conta e nao assinou voltou a entrar?".
 */
export const pingSession = async (req: Request, res: Response) => {
  try {
    await recordTenantLastSeen({
      tenantId: req.user?.tenantId,
      role: req.user?.role,
    });
    return res.status(204).send();
  } catch (error: unknown) {
    // Registrar presenca nunca derruba a tela de quem entrou.
    logger.warn("session_ping_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(204).send();
  }
};
