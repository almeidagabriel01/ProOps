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
