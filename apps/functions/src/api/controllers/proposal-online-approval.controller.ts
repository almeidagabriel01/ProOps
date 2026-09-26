import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { resolveClientIp } from "../../lib/client-ip";
import { hasPagePermission } from "../../lib/auth-helpers";
import { tenantHasCapability } from "../../lib/tenant-capabilities";
import { SharedProposalService } from "../services/shared-proposal.service";
import { NotificationService } from "../services/notification.service";
import {
  OnlineApprovalSchema,
  acceptanceStatus,
  buildClientAcceptance,
  isAcceptancePending,
  isProposalExpired,
  proposalContentHash,
  type ClientAcceptance,
} from "../services/proposal-online-approval";
import { isStatusApproved } from "./proposals.controller";

const PROPOSALS_COLLECTION = "proposals";

/** O que o link público mostra sobre o aceite online. */
export interface OnlineApprovalState {
  /** O formulário de aceite aparece. */
  canApprove: boolean;
  /** Já aprovada pela empresa. */
  approved: boolean;
  /** Validade passou: o cliente precisa pedir uma nova. */
  expired: boolean;
  /** O cliente já aceitou e a empresa ainda não confirmou. */
  awaitingConfirmation: boolean;
  acceptance: Pick<ClientAcceptance, "name" | "acceptedAt"> | null;
}

export async function resolveOnlineApprovalState(
  tenantId: string,
  proposal: Record<string, unknown>,
): Promise<OnlineApprovalState> {
  const acceptance = proposal.clientAcceptance as ClientAcceptance | undefined;
  const [approved, enabled] = await Promise.all([
    isStatusApproved(proposal.status as string | undefined, tenantId),
    tenantHasCapability(tenantId, "onlineApproval"),
  ]);
  const expired = isProposalExpired(proposal.validUntil);
  const isDraft = proposal.status === "draft";
  const pending = isAcceptancePending(acceptance);
  // Aceite descartado ou anulado não é mostrado: o cliente vê a proposta
  // (possivelmente ajustada) e pode aceitar de novo.
  const visible = pending || acceptanceStatus(acceptance) === "confirmed";
  return {
    canApprove: enabled && !approved && !expired && !isDraft && !pending,
    approved,
    expired,
    awaitingConfirmation: pending && !approved,
    acceptance:
      acceptance && visible
        ? { name: acceptance.name, acceptedAt: acceptance.acceptedAt }
        : null,
  };
}

/**
 * `POST /v1/share/:token/accept` — o cliente final aceita a proposta pelo
 * link. Público: o token é a credencial, como no GET do link.
 *
 * Só REGISTRA o aceite e avisa a empresa. Status, lançamentos, Drive e
 * cobrança só acontecem quando alguém da equipe confirma, pelo mesmo caminho
 * de mudar a proposta para aprovada (`updateProposal`).
 */
export const acceptSharedProposal = async (req: Request, res: Response) => {
  const parsed = OnlineApprovalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message || "Dados inválidos." });
  }

  try {
    const shared = await SharedProposalService.getSharedProposal(
      String(req.params.token || ""),
    );
    if (!shared || shared.purpose === "system_pdf_render") {
      return res.status(404).json({ message: "Link não encontrado ou inválido" });
    }
    const { tenantId, proposalId } = shared;

    if (!(await tenantHasCapability(tenantId, "onlineApproval"))) {
      return res.status(403).json({
        message: "O aceite online não está disponível. Fale com a empresa.",
        code: "ONLINE_APPROVAL_UNAVAILABLE",
      });
    }

    const proposalRef = db.collection(PROPOSALS_COLLECTION).doc(proposalId);
    const before = await proposalRef.get();
    const beforeData = before.data();
    if (!before.exists || beforeData?.tenantId !== tenantId) {
      return res.status(404).json({ message: "Proposta não encontrada" });
    }

    const state = await resolveOnlineApprovalState(tenantId, beforeData);
    if (state.approved) {
      return res.status(409).json({
        message: "Esta proposta já foi aprovada.",
        code: "ALREADY_APPROVED",
      });
    }
    if (state.awaitingConfirmation) {
      return res.status(409).json({
        message: "O aceite desta proposta já foi enviado. A empresa vai confirmar.",
        code: "ALREADY_ACCEPTED",
      });
    }
    if (state.expired) {
      return res.status(410).json({
        message: "A validade desta proposta terminou. Peça uma nova à empresa.",
        code: "PROPOSAL_EXPIRED",
      });
    }
    if (beforeData.status === "draft") {
      return res.status(409).json({
        message: "Esta proposta ainda não foi finalizada pela empresa.",
        code: "PROPOSAL_DRAFT",
      });
    }

    const acceptance = buildClientAcceptance({
      input: parsed.data,
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"],
      sharedProposalId: shared.id,
      contentHash: proposalContentHash(beforeData),
    });

    // Relido dentro da transação: dois cliques não gravam dois aceites, e uma
    // edição da empresa no meio do caminho não fica com o aceite da versão velha.
    const proposalData = await db.runTransaction(async (t) => {
      const snap = await t.get(proposalRef);
      const data = snap.data() ?? {};
      if (isAcceptancePending(data.clientAcceptance)) throw new Error("ALREADY_ACCEPTED");
      if (data.status !== beforeData.status || proposalContentHash(data) !== acceptance.contentHash) {
        throw new Error("PROPOSAL_CHANGED");
      }
      const update: Record<string, unknown> = { clientAcceptance: acceptance };
      // O aceite anterior (descartado ou anulado) vira histórico, não some.
      if (data.clientAcceptance) {
        update.clientAcceptanceHistory = FieldValue.arrayUnion(data.clientAcceptance);
      }
      t.update(proposalRef, update);
      return data;
    });

    const title = String(proposalData.title || "sem título");
    await NotificationService.createNotification({
      tenantId,
      type: "proposal_accepted",
      title: "Cliente aceitou a proposta",
      message: `${acceptance.name} aceitou "${title}" pelo link. Confira e confirme a aprovação para gerar o financeiro.`,
      proposalId,
      sharedProposalId: shared.id,
    }).catch(() => undefined);

    return res.status(200).json({ success: true, acceptedAt: acceptance.acceptedAt });
  } catch (error) {
    if (error instanceof Error && error.message === "EXPIRED_LINK") {
      return res.status(410).json({
        message: "Este link expirou. Solicite um novo link ao responsável.",
        code: "EXPIRED_LINK",
      });
    }
    if (error instanceof Error && error.message === "ALREADY_ACCEPTED") {
      return res.status(409).json({
        message: "O aceite desta proposta já foi enviado. A empresa vai confirmar.",
        code: "ALREADY_ACCEPTED",
      });
    }
    if (error instanceof Error && error.message === "PROPOSAL_CHANGED") {
      return res.status(409).json({
        message: "A empresa acabou de alterar esta proposta. Recarregue a página para ver a versão atual.",
        code: "PROPOSAL_CHANGED",
      });
    }
    logger.error("online_acceptance_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ message: "Não foi possível registrar o aceite. Tente de novo." });
  }
};

/**
 * `POST /v1/proposals/:id/acceptance/discard` — a empresa descarta o aceite
 * pendente para ajustar a proposta. O aceite fica registrado como descartado e
 * o cliente pode aceitar de novo pelo mesmo link.
 */
export const discardClientAcceptance = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    const uid = req.user?.uid;
    if (!tenantId || !uid) return res.status(403).json({ message: "Tenant não identificado." });
    if (!(await hasPagePermission(req.user, "proposals", "canEdit"))) {
      return res.status(403).json({ message: "Sem permissão para editar propostas." });
    }

    const proposalRef = db.collection(PROPOSALS_COLLECTION).doc(req.params.id);
    const result = await db.runTransaction(async (t) => {
      const snap = await t.get(proposalRef);
      const data = snap.data();
      if (!snap.exists || data?.tenantId !== tenantId) return "not_found" as const;
      if (!isAcceptancePending(data?.clientAcceptance)) return "not_pending" as const;
      t.update(proposalRef, {
        "clientAcceptance.status": "discarded",
        "clientAcceptance.resolvedAt": new Date().toISOString(),
        "clientAcceptance.resolvedBy": uid,
      });
      return "ok" as const;
    });

    if (result === "not_found") return res.status(404).json({ message: "Proposta não encontrada." });
    if (result === "not_pending") {
      return res.status(409).json({ message: "Não há aceite pendente nesta proposta." });
    }
    return res.json({ success: true });
  } catch (error) {
    logger.error("discard_client_acceptance_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Não foi possível descartar o aceite." });
  }
};
