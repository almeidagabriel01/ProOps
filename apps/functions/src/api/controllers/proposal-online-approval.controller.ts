import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { resolveClientIp } from "../../lib/client-ip";
import { hasPagePermission } from "../../lib/auth-helpers";
import { tenantHasCapability } from "../../lib/tenant-capabilities";
import { SharedProposalService } from "../services/shared-proposal.service";
import { SharedTransactionService } from "../services/shared-transactions.service";
import { NotificationService } from "../services/notification.service";
import {
  ChangeRequestSchema,
  ONLINE_APPROVAL_ACTOR,
  OnlineApprovalSchema,
  acceptanceStatus,
  buildChangeRequest,
  buildClientAcceptance,
  isAcceptancePending,
  isChangeRequestOpen,
  publicChangeRequestHistory,
  type PublicChangeRequest,
  isProposalExpired,
  pickPayableTransaction,
  proposalContentHash,
  type ClientAcceptance,
  type ClientChangeRequest,
  type PayableTransactionRow,
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
  /** O botão de pedir mudanças aparece. */
  canRequestChanges: boolean;
  /** Pedido de mudanças ainda aberto (a empresa está revisando). */
  changeRequest: Pick<ClientChangeRequest, "requestedAt"> | null;
  /** Todos os pedidos de mudanças, do mais novo para o mais antigo, com o status. */
  changeRequests: PublicChangeRequest[];
  /** Aprovada e com algo a pagar online: o link mostra o botão de pagar. */
  payment: { label: string } | null;
}

async function loadPayableTransaction(tenantId: string, proposalId: string) {
  const [tenantSnap, canCharge] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    tenantHasCapability(tenantId, "onlinePayments"),
  ]);
  if (!canCharge || !tenantSnap.data()?.asaasEnabled) return null;
  const snap = await db
    .collection("transactions")
    .where("tenantId", "==", tenantId)
    .where("proposalId", "==", proposalId)
    .limit(50)
    .get();
  return pickPayableTransaction(
    snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as PayableTransactionRow),
  );
}

export async function resolveOnlineApprovalState(
  tenantId: string,
  proposal: Record<string, unknown>,
  proposalId?: string,
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
  const request = proposal.clientChangeRequest as ClientChangeRequest | undefined;
  const requestOpen = isChangeRequestOpen(request);
  const open = enabled && !approved && !expired && !isDraft && !pending;

  let payment: OnlineApprovalState["payment"] = null;
  if (approved && proposalId) {
    // Best-effort: sem isto o cliente só não vê o botão de pagar.
    const target = await loadPayableTransaction(tenantId, proposalId).catch((error) => {
      logger.warn("shared_proposal_payment_lookup_failed", {
        tenantId,
        proposalId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    if (target) payment = { label: target.isDownPayment ? "Pagar entrada" : "Pagar parcela" };
  }

  return {
    canApprove: open,
    approved,
    expired,
    awaitingConfirmation: pending && !approved,
    acceptance:
      acceptance && visible
        ? { name: acceptance.name, acceptedAt: acceptance.acceptedAt }
        : null,
    canRequestChanges: open && !requestOpen,
    changeRequest: requestOpen && request ? { requestedAt: request.requestedAt } : null,
    changeRequests: publicChangeRequestHistory(request, proposal.clientChangeRequestHistory),
    payment,
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
    // Descartar o aceite do cliente é decidir sobre a aprovação: "Aprovar".
    if (!(await hasPagePermission(req.user, "proposals", "approve"))) {
      return res.status(403).json({ message: "Sem permissão para aprovar ou reverter propostas." });
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

/** Link público ainda válido e a proposta dele, ou a resposta de erro. */
async function loadSharedProposalForClient(req: Request, res: Response) {
  const shared = await SharedProposalService.getSharedProposal(String(req.params.token || ""));
  if (!shared || shared.purpose === "system_pdf_render") {
    res.status(404).json({ message: "Link não encontrado ou inválido" });
    return null;
  }
  const proposalRef = db.collection(PROPOSALS_COLLECTION).doc(shared.proposalId);
  const snap = await proposalRef.get();
  const data = snap.data();
  if (!snap.exists || data?.tenantId !== shared.tenantId) {
    res.status(404).json({ message: "Proposta não encontrada" });
    return null;
  }
  return { shared, proposalRef, data: data as Record<string, unknown> };
}

function sharedLinkErrorResponse(error: unknown, res: Response, fallback: string) {
  if (error instanceof Error && error.message === "EXPIRED_LINK") {
    return res.status(410).json({
      message: "Este link expirou. Solicite um novo link ao responsável.",
      code: "EXPIRED_LINK",
    });
  }
  logger.error("shared_proposal_client_action_failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  return res.status(500).json({ message: fallback });
}

/**
 * `POST /v1/share/:token/request-changes` — o cliente aponta o que precisa
 * mudar. Justificativa obrigatória. O pedido fica aberto até a empresa editar
 * a proposta, aprová-la, recusá-la ou marcar como resolvido.
 */
export const requestSharedProposalChanges = async (req: Request, res: Response) => {
  const parsed = ChangeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: parsed.error.issues[0]?.message || "Dados inválidos." });
  }

  try {
    const loaded = await loadSharedProposalForClient(req, res);
    if (!loaded) return;
    const { shared, proposalRef, data } = loaded;
    const { tenantId, proposalId } = shared;

    if (!(await tenantHasCapability(tenantId, "onlineApproval"))) {
      return res.status(403).json({
        message: "Esta opção não está disponível. Fale com a empresa.",
        code: "ONLINE_APPROVAL_UNAVAILABLE",
      });
    }
    const state = await resolveOnlineApprovalState(tenantId, data);
    if (state.changeRequest) {
      return res.status(409).json({
        message: "Seu pedido de mudanças já foi enviado. A empresa está revisando.",
        code: "CHANGES_ALREADY_REQUESTED",
      });
    }
    if (!state.canRequestChanges) {
      return res.status(409).json({
        message: state.expired
          ? "A validade desta proposta terminou. Peça uma nova à empresa."
          : "Esta proposta não aceita pedidos de mudança agora.",
        code: "CHANGES_NOT_ALLOWED",
      });
    }

    const request = buildChangeRequest({
      input: parsed.data,
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"],
      sharedProposalId: shared.id,
      contentHash: proposalContentHash(data),
    });
    await db.runTransaction(async (t) => {
      const snap = await t.get(proposalRef);
      const current = snap.data() ?? {};
      if (isChangeRequestOpen(current.clientChangeRequest)) throw new Error("CHANGES_ALREADY_REQUESTED");
      const update: Record<string, unknown> = { clientChangeRequest: request };
      if (current.clientChangeRequest) {
        update.clientChangeRequestHistory = FieldValue.arrayUnion(current.clientChangeRequest);
      }
      t.update(proposalRef, update);
    });

    const title = String(data.title || "sem título");
    const excerpt =
      request.message.length > 160 ? `${request.message.slice(0, 157)}...` : request.message;
    await NotificationService.createNotification({
      tenantId,
      type: "proposal_changes_requested",
      title: "Cliente pediu mudanças na proposta",
      message: `${request.name || "O cliente"} pediu ajustes em "${title}": "${excerpt}"`,
      proposalId,
      sharedProposalId: shared.id,
    }).catch(() => undefined);

    return res.status(200).json({ success: true, requestedAt: request.requestedAt });
  } catch (error) {
    if (error instanceof Error && error.message === "CHANGES_ALREADY_REQUESTED") {
      return res.status(409).json({
        message: "Seu pedido de mudanças já foi enviado. A empresa está revisando.",
        code: "CHANGES_ALREADY_REQUESTED",
      });
    }
    return sharedLinkErrorResponse(error, res, "Não foi possível enviar o pedido. Tente de novo.");
  }
};

/**
 * `POST /v1/share/:token/payment-link` — o cliente vai pagar a entrada (ou a
 * próxima parcela) de uma proposta aprovada. Reaproveita o link público do
 * lançamento, que já existe para a cobrança enviada pela empresa.
 */
export const createSharedProposalPaymentLink = async (req: Request, res: Response) => {
  try {
    const loaded = await loadSharedProposalForClient(req, res);
    if (!loaded) return;
    const { shared, data } = loaded;
    const { tenantId, proposalId } = shared;

    if (!(await isStatusApproved(data.status as string | undefined, tenantId))) {
      return res.status(409).json({
        message: "A proposta ainda não foi aprovada pela empresa.",
        code: "NOT_APPROVED",
      });
    }
    const target = await loadPayableTransaction(tenantId, proposalId);
    if (!target) {
      return res.status(404).json({
        message: "Não há pagamento em aberto para esta proposta.",
        code: "NOTHING_TO_PAY",
      });
    }
    const link = await SharedTransactionService.createShareLink(
      target.id,
      tenantId,
      ONLINE_APPROVAL_ACTOR,
    );
    return res.status(200).json({ url: link.shareUrl });
  } catch (error) {
    return sharedLinkErrorResponse(error, res, "Não foi possível abrir o pagamento. Tente de novo.");
  }
};

/**
 * `POST /v1/proposals/:id/change-request/resolve` — a empresa dá o pedido de
 * mudanças por encerrado sem editar a proposta (conversou e não precisa mudar).
 */
export const resolveClientChangeRequest = async (req: Request, res: Response) => {
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
      if (!isChangeRequestOpen(data?.clientChangeRequest)) return "not_open" as const;
      t.update(proposalRef, {
        "clientChangeRequest.status": "resolved",
        "clientChangeRequest.resolvedAt": new Date().toISOString(),
        "clientChangeRequest.resolvedBy": uid,
      });
      return "ok" as const;
    });

    if (result === "not_found") return res.status(404).json({ message: "Proposta não encontrada." });
    if (result === "not_open") {
      return res.status(409).json({ message: "Não há pedido de mudanças aberto nesta proposta." });
    }
    return res.json({ success: true });
  } catch (error) {
    logger.error("resolve_client_change_request_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ message: "Não foi possível encerrar o pedido." });
  }
};
