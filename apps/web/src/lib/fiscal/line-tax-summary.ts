/**
 * O resumo de uma linha no painel "Impostos" fechado: o que a prévia aplicou,
 * em uma linha curta. Puro, para o texto não depender de render.
 */

import { formatCurrency } from "@/utils/format";
import type { FiscalNfeLineView } from "@/services/fiscal-service";

export function lineTaxSummary(line: FiscalNfeLineView | undefined): string {
  if (!line) return "Impostos";
  const partes: string[] = [];

  const { icms } = line;
  let textoIcms = `ICMS ${icms.kind === "csosn" ? "CSOSN" : "CST"} ${icms.situacao}`;
  if (icms.valor) textoIcms += `: ${formatCurrency(icms.valor)}`;
  if (icms.valorCredito) textoIcms += `, crédito de ${formatCurrency(icms.valorCredito)}`;
  partes.push(textoIcms);

  if (line.ipi?.cst) {
    partes.push(line.ipiValor ? `IPI: ${formatCurrency(line.ipiValor)}` : `IPI CST ${line.ipi.cst}`);
  }

  const { pis, cofins } = line;
  if (pis.valor || cofins.valor) {
    partes.push(`PIS: ${formatCurrency(pis.valor ?? 0)}, COFINS: ${formatCurrency(cofins.valor ?? 0)}`);
  } else if (pis.cst === cofins.cst) {
    partes.push(`PIS/COFINS ${pis.cst}`);
  } else {
    partes.push(`PIS ${pis.cst}, COFINS ${cofins.cst}`);
  }

  return partes.join(" · ");
}
