import { AggregateField } from "firebase-admin/firestore";
import { db } from "../../init";
import { resolveUserAndTenant } from "../../lib/auth-helpers";

/**
 * Summary financeiro via aggregation queries — substitui o cálculo no
 * browser que baixava a coleção inteira do tenant (2× por page load).
 *
 * Custo: 2 aggregations (income/expense) × 1 leitura por 1000 docs varridos.
 * Tenant com 5.000 lançamentos: ~10 leituras vs ~10.000 do modelo antigo.
 *
 * Fonte: campos desnormalizados `paidTotal`/`pendingTotal` mantidos pelo
 * trigger onTransactionTotals (semântica em lib/transaction-totals.ts).
 * Docs sem os campos (pré-backfill) são ignorados pelo sum() — rodar
 * scripts/backfill-transaction-totals.ts antes de apontar o frontend.
 */

export type TransactionsSummary = {
  totalIncome: number;
  totalExpense: number;
  pendingIncome: number;
  pendingExpense: number;
};

async function sumTotalsByType(
  tenantId: string,
  type: "income" | "expense",
): Promise<{ paid: number; pending: number }> {
  const snapshot = await db
    .collection("transactions")
    .where("tenantId", "==", tenantId)
    .where("type", "==", type)
    .aggregate({
      paid: AggregateField.sum("paidTotal"),
      pending: AggregateField.sum("pendingTotal"),
    })
    .get();

  const data = snapshot.data();
  return {
    paid: Number(data.paid) || 0,
    pending: Number(data.pending) || 0,
  };
}

export async function getTransactionsSummary(
  userId: string,
  claims: Parameters<typeof resolveUserAndTenant>[1],
  requestedTenantId?: string,
): Promise<TransactionsSummary> {
  const { tenantId, isSuperAdmin } = await resolveUserAndTenant(userId, claims);

  // Superadmin pode consultar outro tenant (impersonation no dashboard);
  // qualquer outro role SEMPRE usa o tenant do próprio auth context.
  const effectiveTenantId =
    isSuperAdmin && requestedTenantId?.trim()
      ? requestedTenantId.trim()
      : tenantId;

  if (!effectiveTenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  const [income, expense] = await Promise.all([
    sumTotalsByType(effectiveTenantId, "income"),
    sumTotalsByType(effectiveTenantId, "expense"),
  ]);

  return {
    totalIncome: income.paid,
    pendingIncome: income.pending,
    totalExpense: expense.paid,
    pendingExpense: expense.pending,
  };
}
