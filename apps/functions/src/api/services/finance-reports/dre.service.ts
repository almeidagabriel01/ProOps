import { db } from "../../../init";
import { computeDre, monthsBetween, type DreBasis, type DreResult } from "./dre-model";
import { listCategories } from "./transaction-categories";

/** Até 12 meses por consulta: é o que a tela mostra e o que o custo aguenta. */
export const MAX_DRE_MONTHS = 12;
const QUERY_LIMIT = 10_000;

export class DreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/** Início do mês em Brasília (03:00 UTC), em ISO. */
export function brazilMonthStartIso(month: string): string {
  return `${month}-01T03:00:00.000Z`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function validateRange(from: string, to: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(to)) {
    throw new DreError(400, "Período inválido.");
  }
  const months = monthsBetween(from, to).length;
  if (from > to || months === 0) throw new DreError(400, "O início do período vem depois do fim.");
  if (months > MAX_DRE_MONTHS) throw new DreError(400, `O período vai até ${MAX_DRE_MONTHS} meses.`);
}

/**
 * Os lançamentos que podem cair no período. Competência: pela data do
 * lançamento. Caixa: também pela data (o que nasceu pago não tem `paidAt`) E
 * pelo `paidAt` (o que foi pago no período mas lançado antes); a conta de que
 * mês cada um cai fica no `computeDre`. Os dois índices já existem.
 */
export async function loadTransactions(tenantId: string, from: string, to: string, basis: DreBasis) {
  const byDate = db
    .collection("transactions")
    .where("tenantId", "==", tenantId)
    .where("date", ">=", `${from}-01`)
    .where("date", "<=", lastDayOf(to))
    .limit(QUERY_LIMIT)
    .get();
  const byPaidAt =
    basis === "cash"
      ? db
          .collection("transactions")
          .where("tenantId", "==", tenantId)
          .where("paidAt", ">=", brazilMonthStartIso(from))
          .where("paidAt", "<", brazilMonthStartIso(nextMonth(to)))
          .limit(QUERY_LIMIT)
          .get()
      : null;
  const [dateSnap, paidSnap] = await Promise.all([byDate, byPaidAt]);
  const docs = new Map<string, Record<string, unknown>>();
  for (const doc of dateSnap.docs) docs.set(doc.id, doc.data());
  for (const doc of paidSnap?.docs ?? []) docs.set(doc.id, doc.data());
  const truncated = dateSnap.size >= QUERY_LIMIT || (paidSnap?.size ?? 0) >= QUERY_LIMIT;
  return { transactions: [...docs.values()], truncated };
}

export async function buildDre(
  tenantId: string,
  params: { from: string; to: string; basis: DreBasis },
): Promise<DreResult & { truncated: boolean }> {
  validateRange(params.from, params.to);
  const [{ transactions, truncated }, categories] = await Promise.all([
    loadTransactions(tenantId, params.from, params.to, params.basis),
    listCategories(tenantId),
  ]);
  return { ...computeDre({ transactions, categories, ...params }), truncated };
}
