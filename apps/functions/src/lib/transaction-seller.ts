/**
 * O vendedor que um lançamento de proposta deve carregar (`sellerId`): o da
 * proposta, para o recorte "só os das minhas vendas" de Lançamentos. A
 * comissão fica sem, porque é despesa da empresa com o parceiro. Lançamento
 * sem proposta não é tocado.
 *
 * `undefined` = nada a mudar; `null` = apagar o vendedor que não vale mais.
 */
export function expectedTransactionSeller(
  transaction: Record<string, unknown>,
  proposalSellerId: string | null | undefined,
): string | null | undefined {
  if (!transaction.proposalId) return undefined;
  const expected = transaction.isCommission ? null : proposalSellerId || null;
  const current = (transaction.sellerId as string | null | undefined) ?? null;
  return current === expected ? undefined : expected;
}
