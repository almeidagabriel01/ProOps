import type { TransactionType } from "@/services/transaction-service";

/**
 * Tipo inicial do formulário de novo lançamento, lido de `?type=`.
 *
 * Atalhos como "Nova Despesa" (Ctrl+K) abrem `/transactions/new?type=expense`.
 * Valor ausente ou desconhecido cai em receita, que é o padrão do formulário.
 */
export function resolveInitialTransactionType(
  param: string | null | undefined,
): TransactionType {
  return param === "expense" ? "expense" : "income";
}
