"use client";

import { Transaction } from "@/services/transaction-service";

const LEGACY_PROPOSAL_DESCRIPTION_PREFIX =
  /^(?:Entrada:\s*|Parcela\s+\d+\s*\/\s*\d+:\s*|Proposta:\s*)/i;

export function getProposalTransactionDisplayName(
  transaction: Pick<Transaction, "description" | "proposalId">,
): string {
  const description = String(transaction.description || "").trim();
  if (!description) return "";
  if (!transaction.proposalId) return description;

  const normalized = description.replace(LEGACY_PROPOSAL_DESCRIPTION_PREFIX, "").trim();
  return normalized || description;
}

export function isProposalLinkedTransaction(
  transaction: Pick<Transaction, "proposalId"> | null | undefined,
): boolean {
  return Boolean(transaction?.proposalId);
}

/**
 * Rótulo da linha dentro de um grupo de parcelas.
 *
 * A comissão é gravada como UMA série numerada 1..N sobre as receitas que ela
 * espelha, entrada inclusive: fora de uma série, o card de grupo não lista o
 * membro e a comissão da entrada sumia da tela. Mas "Parcela 1/5" esconde do
 * usuário que aquela primeira linha é a comissão da ENTRADA, que é o que o
 * cartão de receita mostra em destaque logo acima.
 *
 * Então a estrutura continua sendo série e só o rótulo diz o que a linha é.
 * Devolve `null` quando não há rótulo de parcela, deixando o call site cair na
 * descrição.
 */
export function getInstallmentLabel(
  transaction: Pick<
    Transaction,
    "isInstallment" | "installmentNumber" | "installmentCount" | "commissionSourceKey"
  >,
): string | null {
  if (transaction.commissionSourceKey === "down_payment") return "Entrada";
  if (!transaction.isInstallment) return null;
  return `Parcela ${transaction.installmentNumber}/${transaction.installmentCount}`;
}
