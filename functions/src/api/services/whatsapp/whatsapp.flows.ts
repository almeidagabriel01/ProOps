import { db } from "../../../init";
import { formatCurrency } from "./whatsapp.utils";
import {
  queryProposalsForTenant,
  getProposalByIdForTenant,
  getTodaysTransactions,
  getWalletSummary,
} from "./whatsapp.db";
import { logAction, updateSession } from "./whatsapp.session";
import { sendWhatsAppMessage } from "./whatsapp.api";
import { SharedProposalService } from "../shared-proposal.service";

export async function handleListProposals(
  to: string,
  tenantId: string,
  userId: string,
) {
  await logAction(to, userId, "list_proposals");

  try {
    const proposals = await queryProposalsForTenant(db, tenantId, 10);

    if (proposals.length === 0) {
      await sendWhatsAppMessage(to, "Nenhuma proposta encontrada.");
      await updateSession(to, { lastAction: "idle", proposalsShown: [] });
      return;
    }

    let msg = "📄 *Propostas recentes:*\n\n";
    const proposalsShown: { id: string; index: number }[] = [];

    proposals.forEach((p, index) => {
      const value = p.totalValue ? formatCurrency(p.totalValue) : "R$ 0,00";
      const displayIndex = index + 1;
      const title = String(p.title || "Proposta");
      const client = String(p.clientName || "Sem cliente");

      proposalsShown.push({ id: p.id, index: displayIndex });
      msg += `${displayIndex}. ${title} – ${client} – ${value}\n`;
    });

    msg +=
      "\nDigite o número da proposta para receber o PDF.\nOu digite *0* para voltar ao menu inicial.";

    await sendWhatsAppMessage(to, msg);

    await updateSession(to, {
      lastAction: "awaiting_proposal_selection",
      proposalsShown,
    });
  } catch (error) {
    console.error("[WhatsApp] Error in handleListProposals:", error);
    await sendWhatsAppMessage(to, "Nenhuma proposta encontrada.");
    await updateSession(to, { lastAction: "idle", proposalsShown: [] });
  }
}

export async function handleSendPdf(
  to: string,
  tenantId: string,
  proposalIdOrFragment: string,
  userId: string,
) {
  await logAction(to, userId, "send_pdf_attempt", {
    proposalId: proposalIdOrFragment,
  });

  try {
    const proposal = await getProposalByIdForTenant(
      tenantId,
      proposalIdOrFragment,
    );

    if (!proposal) {
      await sendWhatsAppMessage(to, "Não encontrei a proposta.");
      await updateSession(to, { lastAction: "idle", proposalsShown: [] });
      return;
    }

    const result = await SharedProposalService.createShareLink(
      proposal.id,
      tenantId,
      userId,
    );

    const message = `📄 *Sua proposta está pronta!*\n\nAcesse o link abaixo para visualizar a proposta *${String(proposal.title || proposal.id)}* em detalhes. Na página, você também pode baixar o PDF completo.\n\n🔗 ${result.shareUrl}`;

    await sendWhatsAppMessage(to, message);

    await logAction(to, userId, "send_pdf_success", {
      proposalId: proposal.id,
      shareUrl: result.shareUrl,
    });

    await updateSession(to, { lastAction: "idle", proposalsShown: [] });
  } catch (error) {
    console.error("[WhatsApp] Error in handleSendPdf:", error);
    await sendWhatsAppMessage(
      to,
      "Ocorreu um erro ao gerar o link da proposta.",
    );
    await updateSession(to, { lastAction: "idle", proposalsShown: [] });
  }
}

export async function handleFinancialDaySummary(
  to: string,
  tenantId: string,
  userId: string,
) {
  await logAction(to, userId, "view_financial_summary");

  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const todayTransactions = await getTodaysTransactions(tenantId, start, end);

    if (todayTransactions.length === 0) {
      await sendWhatsAppMessage(to, "Nenhuma movimentação hoje.");
      return;
    }

    let entries = 0;
    let exits = 0;

    todayTransactions.forEach((t) => {
      if (t.type === "income") entries += t.amount;
      if (t.type === "expense") exits += t.amount;
    });

    const balance = entries - exits;
    const sign = balance >= 0 ? "+" : "";

    const msg = `📊 *Resumo financeiro de hoje:*\n\nEntradas: ${formatCurrency(entries)}\nSaídas: ${formatCurrency(exits)}\nResultado: *${sign}${formatCurrency(balance)}*`;

    await sendWhatsAppMessage(to, msg);
  } catch (error) {
    console.error("[WhatsApp] Error in handleFinancialDaySummary:", error);
    await sendWhatsAppMessage(to, "Nenhuma movimentação hoje.");
  }
}

export async function handleCurrentBalance(
  to: string,
  tenantId: string,
  userId: string,
) {
  await logAction(to, userId, "view_balance");

  try {
    const summary = await getWalletSummary(tenantId);

    if (!Number.isFinite(summary.totalBalance)) {
      await sendWhatsAppMessage(to, "Saldo indisponível no momento.");
      return;
    }

    const msg = `💰 *Saldo atual consolidado:*\n\n${formatCurrency(summary.totalBalance)}`;
    await sendWhatsAppMessage(to, msg);
  } catch (error) {
    console.error("[WhatsApp] Error in handleCurrentBalance:", error);
    await sendWhatsAppMessage(to, "Saldo indisponível no momento.");
  }
}
