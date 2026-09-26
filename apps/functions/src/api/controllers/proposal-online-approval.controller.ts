import { Request, Response } from "express";
import { db } from "../../init";
import { logger } from "../../lib/logger";
import { resolveClientIp } from "../../lib/client-ip";
import { tenantHasCapability } from "../../lib/tenant-capabilities";
import { SharedProposalService } from "../services/shared-proposal.service";
import { SharedTransactionService } from "../services/shared-transactions.service";
import { NotificationService } from "../services/notification.service";
import {
  isDriveConnected,
  isStatusDeliverableToDrive,
} from "../services/drive/proposal-drive-sync.service";
import { enqueueDriveDelivery } from "../services/drive/drive-delivery-queue";
import {
  ONLINE_APPROVAL_ACTOR,
  OnlineApprovalSchema,
  buildClientAcceptance,
  isProposalExpired,
  resolveApprovedStatusForTenant,
  type ClientAcceptance,
} from "../services/proposal-online-approval";
import {
  isStatusApproved,
  syncApprovedProposalTransactions,
} from "./proposals.controller";

const PROPOSALS_COLLECTION = "proposals";

/** O que o link público mostra sobre a aprovação online. */
export interface OnlineApprovalState {
  /** O botão de aprovar aparece. */
  canApprove: boolean;
  /** Já aprovada (por aqui ou pela empresa). */
  approved: boolean;
  /** Validade passou: o cliente precisa pedir uma nova. */
  expired: boolean;
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
  return {
    canApprove: enabled && !approved && !expired && !isDraft,
    approved,
    expired,
    acceptance: acceptance
      ? { name: acceptance.name, acceptedAt: acceptance.acceptedAt }
      : null,
  };
}

/**
 * Link de pagamento do sinal (ou da 1ª parcela) depois da aprovação, quando a
 * empresa recebe online. Best-effort: sem ele o cliente só não vê o botão.
 */
async function resolvePaymentUrl(
  tenantId: string,
  proposalId: string,
): Promise<string | null> {
  try {
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
    type TxRow = {
      id: string;
      type?: string;
      isCommission?: boolean;
      isDownPayment?: boolean;
      status?: string;
      dueDate?: string;
    };
    const candidates = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as TxRow)
      .filter((t) => t.type === "income" && !t.isCommission && t.status !== "paid");
    const target =
      candidates.find((t) => t.isDownPayment) ??
      candidates.sort((a, b) =>
        String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")),
      )[0];
    if (!target) return null;

    const link = await SharedTransactionService.createShareLink(
      target.id,
      tenantId,
      ONLINE_APPROVAL_ACTOR,
    );
    return link.shareUrl;
  } catch (error) {
    logger.warn("online_approval_payment_link_failed", {
      tenantId,
      proposalId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * `POST /v1/share/:token/approve` — o cliente final aprova a proposta pelo
 * link. Público: o token é a credencial, como no GET do link.
 *
 * Roda as MESMAS consequências da aprovação feita no ERP: lançamentos da
 * entrada e das parcelas, comissões, nota automática (regra "ao aprovar") e
 * entrega no Drive. Sem isso a proposta mudaria de coluna com o financeiro
 * vazio, que é o defeito que o `update_crm_status` da Lia tem hoje.
 */
export const approveSharedProposal = async (req: Request, res: Response) => {
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
        message: "A aprovação online não está disponível. Fale com a empresa.",
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

    const approvedStatus = await resolveApprovedStatusForTenant(tenantId);
    const acceptance = buildClientAcceptance({
      input: parsed.data,
      ip: resolveClientIp(req),
      userAgent: req.headers["user-agent"],
      sharedProposalId: shared.id,
    });
    const now = new Date().toISOString();

    // O status é relido dentro da transação: dois cliques (ou a empresa
    // aprovando ao mesmo tempo) não podem gerar os lançamentos duas vezes.
    const proposalData = await db.runTransaction(async (t) => {
      const snap = await t.get(proposalRef);
      const data = snap.data() ?? {};
      if (data.status !== beforeData.status || data.clientAcceptance) {
        throw new Error("ALREADY_APPROVED");
      }
      t.update(proposalRef, {
        status: approvedStatus,
        clientAcceptance: acceptance,
        updatedAt: now,
      });
      return {
        ...data,
        status: approvedStatus,
        clientAcceptance: acceptance,
      } as Record<string, unknown>;
    });

    let syncFailed = false;
    try {
      await syncApprovedProposalTransactions({
        proposalId,
        proposalTenantId: tenantId,
        proposalData,
        userId: ONLINE_APPROVAL_ACTOR,
        initialStatus: "pending",
      });
    } catch (error) {
      syncFailed = true;
      logger.error("online_approval_sync_failed", {
        tenantId,
        proposalId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (
      (await isStatusDeliverableToDrive(approvedStatus, tenantId)) &&
      (await isDriveConnected(tenantId))
    ) {
      await enqueueDriveDelivery({ tenantId, proposalId }).catch((error) =>
        logger.warn("online_approval_drive_enqueue_failed", {
          tenantId,
          proposalId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    const title = String(proposalData.title || "sem título");
    await NotificationService.createNotification({
      tenantId,
      type: "proposal_approved",
      title: "Proposta aprovada pelo cliente",
      message: syncFailed
        ? `${acceptance.name} aprovou "${title}" pelo link, mas os lançamentos não foram gerados. Abra a proposta e salve de novo para gerá-los.`
        : `${acceptance.name} aprovou "${title}" pelo link.`,
      proposalId,
      sharedProposalId: shared.id,
    }).catch(() => undefined);

    const paymentUrl = syncFailed
      ? null
      : await resolvePaymentUrl(tenantId, proposalId);

    return res.status(200).json({
      success: true,
      acceptedAt: acceptance.acceptedAt,
      paymentUrl,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "EXPIRED_LINK") {
      return res.status(410).json({
        message: "Este link expirou. Solicite um novo link ao responsável.",
        code: "EXPIRED_LINK",
      });
    }
    if (error instanceof Error && error.message === "ALREADY_APPROVED") {
      return res.status(409).json({
        message: "Esta proposta já foi aprovada.",
        code: "ALREADY_APPROVED",
      });
    }
    logger.error("online_approval_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return res
      .status(500)
      .json({ message: "Não foi possível registrar a aprovação. Tente de novo." });
  }
};
