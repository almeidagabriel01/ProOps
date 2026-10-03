import { db } from "../../init";
import {
  aggregateCommissionDocs,
  loadMonthCommissionDocs,
  resolveMonthRange,
  type CommissionReportPartner,
} from "./commission-report.service";

/**
 * "Minhas comissões": o que a empresa deve, no mês, à pessoa da equipe que
 * também é parceira de comissão (vendedor ou arquiteto ligado a ela pelo
 * `linkedMemberId` do contato).
 *
 * Não pede a permissão do financeiro: o filtro pelo próprio uid é a
 * permissão. A pessoa vê só as comissões do contato ligado a ela, nunca as dos
 * outros parceiros nem o resto do financeiro.
 *
 * Reaproveita a consulta do relatório geral (comissões do mês da empresa, no
 * índice `tenantId, isCommission, dueDate`) e filtra pelo contato em memória:
 * são dezenas de documentos por mês, e assim não nasce índice novo.
 */

export interface MyCommissions {
  month: string;
  /** A pessoa tem um contato parceiro ligado a ela. Sem isso o card some. */
  linked: boolean;
  aPagar: number;
  pago: number;
  total: number;
  partners: CommissionReportPartner[];
}

export async function getMyCommissions(
  tenantId: string,
  uid: string,
  month: string,
): Promise<MyCommissions> {
  const range = resolveMonthRange(month);
  const linked = await db
    .collection("clients")
    .where("tenantId", "==", tenantId)
    .where("linkedMemberId", "==", uid)
    .limit(5)
    .get();

  const contactIds = new Set(linked.docs.map((doc) => doc.id));
  if (contactIds.size === 0) {
    return { month: range.month, linked: false, aPagar: 0, pago: 0, total: 0, partners: [] };
  }

  const docs = await loadMonthCommissionDocs(tenantId, range);
  const mine = docs.filter((doc) =>
    contactIds.has(String(doc.data().commissionContactId || "").trim()),
  );
  return { month: range.month, linked: true, ...aggregateCommissionDocs(mine) };
}
