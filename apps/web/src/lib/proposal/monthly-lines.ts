/**
 * Linha de mensalidade na proposta (`isMonthly`): monitoramento, manutenção,
 * suporte. Ela não entra no total, na entrada nem nas parcelas da venda, e
 * aparece à parte como "+ R$ X/mês". Na aprovação vira um contrato em
 * rascunho (backend: `ensureContractFromProposal`), cobrado todo mês.
 *
 * Toda soma do total da proposta passa por `countsInProposalTotal`, e o valor
 * mensal sai de `monthlyTotal`: o formulário, o envio e o PDF usam os mesmos.
 */

interface LineLike {
  isMonthly?: boolean;
  quantity?: number;
  total?: number;
  status?: string;
}

export function isMonthlyLine(line: LineLike): boolean {
  return line.isMonthly === true;
}

/** A linha entra no total da venda (entrada e parcelas)? */
export function countsInProposalTotal(line: LineLike): boolean {
  return !isMonthlyLine(line);
}

/** Soma das mensalidades ativas: o "+ R$ X/mês". */
export function monthlyTotal(lines: readonly LineLike[]): number {
  const sum = lines.reduce(
    (acc, line) =>
      isMonthlyLine(line) && line.status !== "inactive" && Number(line.quantity || 0) > 0
        ? acc + Number(line.total || 0)
        : acc,
    0,
  );
  return Math.round(sum * 100) / 100;
}
