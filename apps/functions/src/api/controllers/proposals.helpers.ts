import { db } from "../../init";
import {
  buildCommissionDrafts,
  buildCommissionTransactionKey,
  readProposalCommissions,
  type CommissionDraft,
  type CommissionSourceDraft,
} from "./proposal-commissions";

/**
 * Um lancamento gerado pela aprovacao da proposta.
 *
 * O tipo cobre RECEITA (o que o cliente paga) e DESPESA de comissao (o que o
 * parceiro recebe), porque os dois atravessam o mesmo diff idempotente em
 * `syncApprovedProposalTransactions`. Os campos de comissao sao opcionais e so
 * aparecem nas despesas; ver `proposal-commissions.ts`.
 */
export type ProposalLinkedTransactionDraft = {
  tenantId: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  date: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  clientId: string | null;
  clientName: string | null;
  proposalId: string;
  proposalGroupId: string | null;
  category: string | null;
  wallet: string | null;
  isDownPayment: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  isInstallment: boolean;
  installmentCount: number | null;
  installmentNumber: number | null;
  installmentGroupId: string | null;
  notes: string;
  createdById: string;
  isCommission?: boolean;
  commissionContactId?: string;
  commissionContactName?: string;
  commissionRole?: CommissionDraft["commissionRole"];
  commissionPercentage?: number;
  commissionSourceKey?: string;
};

export function normalizeProposalTransactionTitle(value: unknown): string {
  return String(value || "").trim() || "Proposta";
}

export function buildProposalGroupId(proposalId: string): string {
  return `proposal_${proposalId}`;
}

export function buildProposalInstallmentGroupId(proposalId: string): string {
  return `proposal_installments_${proposalId}`;
}

export async function resolveDefaultWalletNameForTenant(
  tenantId: string,
): Promise<string | null> {
  const walletsQuery = await db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .where("isDefault", "==", true)
    .limit(1)
    .get();

  if (!walletsQuery.empty) {
    return walletsQuery.docs[0].data().name || null;
  }

  const anyWallet = await db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (!anyWallet.empty) {
    return anyWallet.docs[0].data().name || null;
  }

  return null;
}

export function buildApprovedProposalTransactionDrafts(params: {
  proposalId: string;
  proposalData: Record<string, unknown>;
  userId: string;
  defaultWalletName: string | null;
  initialStatus?: "paid" | "pending" | "overdue";
}): { drafts: ProposalLinkedTransactionDraft[]; effectiveDownPaymentValue: number; effectiveInstallmentValue: number } {
  const { proposalId, proposalData, userId, defaultWalletName } = params;
  const initialStatus = params.initialStatus || "pending";
  const title = normalizeProposalTransactionTitle(proposalData.title);
  const tenantId = String(proposalData.tenantId || "").trim();
  const clientId = proposalData.clientId ? String(proposalData.clientId) : null;
  const clientName = proposalData.clientName ? String(proposalData.clientName) : null;

  // closedValue overrides totalValue when set and > 0
  const effectiveTotalValue =
    Number(proposalData.closedValue) > 0
      ? Number(proposalData.closedValue)
      : Number(proposalData.totalValue || 0);

  const dpType = String(proposalData.downPaymentType || "fixed");
  const dpPercentage = Number(proposalData.downPaymentPercentage) || 0;
  const installmentsCount = Math.max(1, Number(proposalData.installmentsCount) || 1);

  const effectiveDownPaymentValue = !!proposalData.downPaymentEnabled
    ? dpType === "percentage"
      ? (effectiveTotalValue * dpPercentage) / 100
      : Math.min(Number(proposalData.downPaymentValue) || 0, effectiveTotalValue)
    : 0;

  const remainingValue = Math.max(0, effectiveTotalValue - effectiveDownPaymentValue);
  const effectiveInstallmentValue =
    !!proposalData.installmentsEnabled && Number(proposalData.installmentsCount) > 0
      ? remainingValue / installmentsCount
      : 0;

  const downPaymentEnabled = !!proposalData.downPaymentEnabled && effectiveDownPaymentValue > 0;
  const installmentsEnabled =
    !!proposalData.installmentsEnabled &&
    Number(proposalData.installmentsCount || 0) > 0 &&
    effectiveInstallmentValue > 0;

  const remainingAfterDownPayment = Math.max(0, effectiveTotalValue - effectiveDownPaymentValue);
  // needsSingleSettlement: when no installments but there's still unpaid balance
  const needsSingleSettlement = !installmentsEnabled && remainingAfterDownPayment > 0;

  // proposalGroupId links down payment + saldo (or down payment + installments)
  const useProposalGrouping = downPaymentEnabled && (installmentsEnabled || needsSingleSettlement);
  const proposalGroupId = useProposalGrouping ? buildProposalGroupId(proposalId) : null;
  const installmentGroupId = installmentsEnabled ? buildProposalInstallmentGroupId(proposalId) : null;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const drafts: ProposalLinkedTransactionDraft[] = [];

  if (downPaymentEnabled) {
    drafts.push({
      tenantId,
      type: "income",
      description: title,
      amount: effectiveDownPaymentValue,
      date: String(proposalData.downPaymentDueDate || todayStr),
      dueDate: String(proposalData.downPaymentDueDate || todayStr),
      status: initialStatus,
      clientId,
      clientName,
      proposalId,
      proposalGroupId,
      category: null,
      wallet: proposalData.downPaymentWallet
        ? String(proposalData.downPaymentWallet)
        : defaultWalletName,
      isDownPayment: true,
      downPaymentType: dpType === "percentage" ? "percentage" : "value",
      downPaymentPercentage: dpPercentage,
      isInstallment: false,
      installmentCount: null,
      installmentNumber: null,
      installmentGroupId: null,
      notes: "Entrada gerada automaticamente pela proposta",
      createdById: userId,
    });
  }

  if (installmentsEnabled) {
    const walletName = proposalData.installmentsWallet
      ? String(proposalData.installmentsWallet)
      : defaultWalletName;
    let firstInstDate: Date;
    if (proposalData.firstInstallmentDate) {
      firstInstDate = new Date(String(proposalData.firstInstallmentDate) + "T12:00:00");
    } else {
      firstInstDate = new Date(today);
      firstInstDate.setDate(firstInstDate.getDate() + 30);
    }
    for (let i = 0; i < installmentsCount; i++) {
      const installmentDate = new Date(firstInstDate);
      installmentDate.setMonth(firstInstDate.getMonth() + i);
      const dueDate = installmentDate.toISOString().split("T")[0];
      drafts.push({
        tenantId,
        type: "income",
        description: title,
        amount: effectiveInstallmentValue,
        date: dueDate,
        dueDate,
        status: initialStatus,
        clientId,
        clientName,
        proposalId,
        proposalGroupId,
        category: null,
        wallet: walletName,
        isDownPayment: false,
        isInstallment: true,
        installmentCount: installmentsCount,
        installmentNumber: i + 1,
        installmentGroupId,
        notes: `Parcela ${i + 1}/${installmentsCount} gerada automaticamente`,
        createdById: userId,
      });
    }
  }

  if (needsSingleSettlement) {
    const dueDate = (() => {
      if (proposalData.validUntil) return String(proposalData.validUntil);
      const fallback = new Date(today);
      fallback.setDate(fallback.getDate() + 30);
      return fallback.toISOString().split("T")[0];
    })();
    // When downPayment is set, UI only exposes downPaymentWallet (not installmentsWallet)
    const settlementWallet = downPaymentEnabled
      ? (proposalData.downPaymentWallet
          ? String(proposalData.downPaymentWallet)
          : proposalData.installmentsWallet
            ? String(proposalData.installmentsWallet)
            : defaultWalletName)
      : defaultWalletName;
    drafts.push({
      tenantId,
      type: "income",
      description: title,
      amount: remainingAfterDownPayment,
      date: todayStr,
      dueDate,
      status: initialStatus,
      clientId,
      clientName,
      proposalId,
      proposalGroupId,
      category: null,
      wallet: settlementWallet,
      isDownPayment: false,
      isInstallment: false,
      installmentCount: null,
      installmentNumber: null,
      installmentGroupId: null,
      notes: downPaymentEnabled
        ? "Saldo restante gerado automaticamente pela proposta"
        : "Receita gerada automaticamente pela aprovação da proposta",
      createdById: userId,
    });
  }

  const commissionDrafts = buildCommissionDrafts({
    tenantId,
    proposalId,
    proposalTitle: title,
    commissions: readProposalCommissions(proposalData),
    sources: drafts.map(toCommissionSource),
    baseTotal: effectiveTotalValue,
    walletName: defaultWalletName,
    userId,
  });

  return {
    drafts: [...drafts, ...commissionDrafts],
    effectiveDownPaymentValue,
    effectiveInstallmentValue,
  };
}

/**
 * Converte a receita na "fonte" que a comissao espelha. Reusa a chave do sync
 * para que despesa e receita apontem sempre para a mesma parcela.
 */
function toCommissionSource(
  draft: ProposalLinkedTransactionDraft,
): CommissionSourceDraft {
  return {
    sourceKey:
      getProposalLinkedTransactionKey(
        draft as unknown as Record<string, unknown>,
      ) || "single",
    amount: draft.amount,
    date: draft.date,
    dueDate: draft.dueDate,
    installmentCount: draft.installmentCount,
    installmentNumber: draft.installmentNumber,
  };
}

/**
 * Chave do diff do sync, valida tanto para um draft quanto para um doc ja
 * gravado. Uma funcao so para os dois lados de proposito: chaves que divergem
 * fariam o sync recriar o que ja existe, duplicando lancamento.
 */
export function getProposalLinkedTransactionKey(
  transaction: Record<string, unknown>,
): string | null {
  if (transaction.isPartialPayment || transaction.parentTransactionId) {
    return null;
  }
  if (transaction.isCommission) {
    const contactId = String(transaction.commissionContactId || "").trim();
    const role = String(transaction.commissionRole || "").trim();
    const sourceKey = String(transaction.commissionSourceKey || "").trim();
    if (!contactId || !role || !sourceKey) return null;
    return buildCommissionTransactionKey(contactId, role, sourceKey);
  }
  if (transaction.isDownPayment) return "down_payment";
  if (transaction.isInstallment) {
    return `installment_${Number(transaction.installmentNumber || 0)}`;
  }
  return "single";
}
