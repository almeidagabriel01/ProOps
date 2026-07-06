/**
 * Totais desnormalizados por transação — base do summary financeiro agregado.
 *
 * Um lançamento contribui para DOIS baldes ao mesmo tempo: o valor do pai
 * entra pelo status do pai, e cada extraCost entra pelo PRÓPRIO status
 * (independente do pai). Por isso um único "totalAmount" não basta — o
 * documento carrega `paidTotal` e `pendingTotal`, mantidos pelo trigger
 * onTransactionTotals em todo write. O endpoint GET /v1/transactions/summary
 * soma esses campos via aggregation (1 leitura por 1000 docs) em vez de
 * baixar a coleção inteira no browser.
 *
 * Semântica espelhada do summary legado do frontend
 * (apps/web/src/services/transaction-service.ts):
 * - pai: status === "paid" → paid; QUALQUER outro (pending, overdue, …) → pending
 * - extraCost: (ec.status || "pending") === "paid" → paid; senão pending
 */

export type TransactionTotals = {
  paidTotal: number;
  pendingTotal: number;
};

type ExtraCostLike = {
  amount?: unknown;
  status?: unknown;
};

export type TransactionTotalsInput = {
  amount?: unknown;
  status?: unknown;
  extraCosts?: unknown;
};

function toAmount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isPaidStatus(status: unknown, fallback: string): boolean {
  return String(status ?? fallback).trim().toLowerCase() === "paid";
}

export function computeTransactionTotals(
  data: TransactionTotalsInput,
): TransactionTotals {
  let paidTotal = 0;
  let pendingTotal = 0;

  const amount = toAmount(data.amount);
  if (isPaidStatus(data.status, "pending")) {
    paidTotal += amount;
  } else {
    pendingTotal += amount;
  }

  if (Array.isArray(data.extraCosts)) {
    for (const raw of data.extraCosts) {
      const ec = (raw ?? {}) as ExtraCostLike;
      const ecAmount = toAmount(ec.amount);
      if (isPaidStatus(ec.status, "pending")) {
        paidTotal += ecAmount;
      } else {
        pendingTotal += ecAmount;
      }
    }
  }

  return { paidTotal, pendingTotal };
}

const EPSILON = 0.005; // metade de 1 centavo — imune a ruído de float

/**
 * true quando os totais armazenados divergem dos computados (ou estão
 * ausentes). Usado pelo trigger para decidir se escreve — e para NÃO
 * re-disparar em loop após a própria escrita.
 */
export function storedTotalsDiffer(
  stored: { paidTotal?: unknown; pendingTotal?: unknown },
  computed: TransactionTotals,
): boolean {
  const storedPaid = Number(stored.paidTotal);
  const storedPending = Number(stored.pendingTotal);
  if (!Number.isFinite(storedPaid) || !Number.isFinite(storedPending)) {
    return true;
  }
  return (
    Math.abs(storedPaid - computed.paidTotal) > EPSILON ||
    Math.abs(storedPending - computed.pendingTotal) > EPSILON
  );
}
