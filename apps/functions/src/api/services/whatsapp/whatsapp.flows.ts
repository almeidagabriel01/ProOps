import { db } from "../../../init";
import { formatCurrency } from "./whatsapp.utils";
import {
  queryProposalsForTenant,
  getProposalByIdForTenant,
  getTodaysTransactions,
  getWalletSummary,
  getRecentTransactions,
  getWeeklyPendingTransactions,
} from "./whatsapp.db";
import { logAction, updateSession } from "./whatsapp.session";
import {
  sendWhatsAppMessage,
  sendWhatsAppInteractiveMessage,
} from "./whatsapp.api";
import { SharedProposalService } from "../shared-proposal.service";
import { SharedTransactionService } from "../shared-transactions.service";

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

    const rows = proposals.map((p) => {
      const value = p.totalValue ? formatCurrency(p.totalValue) : "R$ 0,00";
      const titleStr = String(p.title || "Proposta").substring(0, 24);
      const descStr =
        `${String(p.clientName || "Sem cliente")} – ${value}`.substring(0, 72);

      return {
        id: `proposal_pdf_${p.id}`,
        title: titleStr,
        description: descStr,
      };
    });

    const interactivePayload = {
      type: "list",
      header: {
        type: "text",
        text: "📄 Suas Propostas",
      },
      body: {
        text: "Toque no botão abaixo para ver as propostas recentes que separamos para você.",
      },
      footer: {
        text: "Selecione para receber o PDF",
      },
      action: {
        button: "Escolher proposta",
        sections: [
          {
            title: "Propostas Recentes",
            rows: rows,
          },
        ],
      },
    };

    await sendWhatsAppInteractiveMessage(to, interactivePayload);

    await updateSession(to, {
      lastAction: "idle",
      proposalsShown: [],
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
    // Use BRT (UTC-3) for "today" since all tenants are Brazilian
    const now = new Date();
    const brtOffset = -3 * 60; // UTC-3 in minutes
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const brtNow = new Date(utcMs + brtOffset * 60000);

    const start = new Date(brtNow);
    start.setHours(0, 0, 0, 0);
    // Convert BRT midnight back to UTC for Firestore queries
    const startUtc = new Date(start.getTime() - brtOffset * 60000);
    const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

    const todayTransactions = await getTodaysTransactions(
      tenantId,
      startUtc,
      endUtc,
    );

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

export async function handleWeeklySummary(
  to: string,
  tenantId: string,
  userId: string,
) {
  await logAction(to, userId, "view_weekly_summary");

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const diffToMonday =
      today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(today.setDate(diffToMonday));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const pending = await getWeeklyPendingTransactions(
      tenantId,
      weekStart,
      weekEnd,
    );

    if (pending.length === 0) {
      await sendWhatsAppMessage(to, "Nenhuma conta pendente para esta semana.");
      return;
    }

    let toPay = 0;
    let toReceive = 0;

    pending.forEach((t) => {
      if (t.type === "income") toReceive += t.amount;
      if (t.type === "expense") toPay += t.amount;
    });

    const msg = `📅 *Resumo da Semana*\n\n📈 A Receber: ${formatCurrency(toReceive)}\n📉 A Pagar: ${formatCurrency(toPay)}`;

    await sendWhatsAppMessage(to, msg);
  } catch (error) {
    console.error("[WhatsApp] Error in handleWeeklySummary:", error);
    await sendWhatsAppMessage(to, "Erro ao buscar resumo semanal.");
  }
}

export async function handleListRecentTransactions(
  to: string,
  tenantId: string,
  userId: string,
) {
  await logAction(to, userId, "list_recent_transactions");

  try {
    const transactions = await getRecentTransactions(tenantId, 10);

    if (transactions.length === 0) {
      await sendWhatsAppMessage(
        to,
        "Nenhum lançamento encontrado recentemente.",
      );
      return;
    }

    const rows = transactions.map((t) => {
      const value = formatCurrency(t.amount);
      const titleStr = t.description.substring(0, 24);
      const descStr =
        `${t.date.toLocaleDateString("pt-BR")} – ${value}`.substring(0, 72);

      return {
        id: `transaction_link_${t.id}`,
        title: titleStr,
        description: descStr,
      };
    });

    const interactivePayload = {
      type: "list",
      header: {
        type: "text",
        text: "🧾 Últimos Lançamentos",
      },
      body: {
        text: "Escolha um lançamento abaixo para visualizar os detalhes completos.",
      },
      footer: {
        text: "Selecione um lançamento",
      },
      action: {
        button: "Ver Lançamentos",
        sections: [
          {
            title: "Recentes",
            rows: rows,
          },
        ],
      },
    };

    await sendWhatsAppInteractiveMessage(to, interactivePayload);
  } catch (error) {
    console.error("[WhatsApp] Error in handleListRecentTransactions:", error);
    await sendWhatsAppMessage(to, "Nenhum lançamento encontrado.");
  }
}

export async function handleSendTransactionLink(
  to: string,
  tenantId: string,
  transactionId: string,
  userId: string,
) {
  await logAction(to, userId, "send_transaction_link_attempt", {
    transactionId,
  });

  try {
    const result = await SharedTransactionService.createShareLink(
      transactionId,
      tenantId,
      userId,
    );

    const message = `🧾 *Seu lançamento está pronto!*\n\nAcesse o link abaixo para visualizar os detalhes completos do lançamento.\n\n🔗 ${result.shareUrl}`;

    await sendWhatsAppMessage(to, message);

    await logAction(to, userId, "send_transaction_link_success", {
      transactionId,
      shareUrl: result.shareUrl,
    });
  } catch (error) {
    console.error("[WhatsApp] Error in handleSendTransactionLink:", error);
    await sendWhatsAppMessage(
      to,
      "Ocorreu um erro ao gerar o link do lançamento.",
    );
  }
}
