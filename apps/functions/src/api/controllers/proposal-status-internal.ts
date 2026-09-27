import type { Request, Response } from "express";
import { updateProposal } from "./proposals.controller";
import {
  saveRejectionReason,
  validateProposalStatusChange,
} from "../services/proposals.service";

/**
 * Muda o status de uma proposta pelo MESMO caminho da tela, para quem não é
 * uma request HTTP (a Lia).
 *
 * A Lia gravava o status direto no Firestore, e com isso aprovar por ela pulava
 * tudo o que a aprovação faz: os lançamentos no financeiro, o projeto da obra,
 * a entrega no Drive, a data da aprovação das metas e a resolução do aceite do
 * cliente. Replicar essa lógica num segundo lugar voltaria a divergir; aqui o
 * próprio `updateProposal` roda, com a identidade de quem pediu à Lia (e, com
 * ela, a checagem de permissão de membro).
 *
 * O controller só usa `req.user`, `req.params`, `req.body` e `res.locals`.
 */

export interface InternalActor {
  uid: string;
  role: string;
  tenantId: string;
  masterId?: string | null;
}

export interface InternalUpdateResult {
  statusCode: number;
  body: Record<string, unknown>;
}

export async function updateProposalAsUser(
  actor: InternalActor,
  proposalId: string,
  body: Record<string, unknown>,
): Promise<InternalUpdateResult> {
  const result: InternalUpdateResult = { statusCode: 200, body: {} };

  const req = {
    user: {
      uid: actor.uid,
      role: String(actor.role || "").toUpperCase(),
      tenantId: actor.tenantId,
      masterId: actor.masterId ?? undefined,
      isSuperAdmin: false,
      hasRequiredClaims: true,
    },
    params: { id: proposalId },
    body,
    query: {},
    headers: {},
  } as unknown as Request;

  const res = {
    locals: {},
    status(code: number) {
      result.statusCode = code;
      return res;
    },
    json(payload: Record<string, unknown>) {
      result.body = payload ?? {};
      return res;
    },
  } as unknown as Response;

  await updateProposal(req, res);
  return result;
}

/**
 * A mudança de status da Lia: valida as transições dela (rascunho -> enviada
 * -> aprovada ou recusada), roda o `updateProposal` e guarda o motivo da
 * recusa. Erro do controller (permissão, dado inválido) vira exceção com a
 * mesma mensagem que a tela mostraria.
 */
export async function changeProposalStatusAsUser(
  actor: InternalActor,
  proposalId: string,
  newStatus: string,
  reason?: string,
): Promise<{ id: string; oldStatus: string; newStatus: string }> {
  const { oldStatus } = await validateProposalStatusChange(
    proposalId,
    newStatus,
    actor.tenantId,
    reason,
  );
  const result = await updateProposalAsUser(actor, proposalId, { status: newStatus });
  if (result.statusCode >= 400) {
    throw new Error(String(result.body.message || "Não foi possível mudar o status da proposta."));
  }
  if (reason) await saveRejectionReason(proposalId, reason);
  return { id: proposalId, oldStatus, newStatus };
}
