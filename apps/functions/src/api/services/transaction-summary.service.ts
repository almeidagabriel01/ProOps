import { AggregateField } from "firebase-admin/firestore";
import { db } from "../../init";
import { getPageScope, resolveUserAndTenant } from "../../lib/auth-helpers";
import { checkFinancialPermission } from "../../lib/finance-helpers";

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
  sellerId?: string,
): Promise<{ paid: number; pending: number }> {
  let query = db.collection("transactions").where("tenantId", "==", tenantId).where("type", "==", type);
  // "Só os das minhas vendas": índice (tenantId, type, sellerId, paidTotal, pendingTotal).
  if (sellerId) query = query.where("sellerId", "==", sellerId);
  const snapshot = await query
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
  // Era a UNICA rota financeira que parava no resolveUserAndTenant: devolvia o
  // total pago e pendente do tenant a qualquer membro, inclusive a quem nao
  // tem a pagina de Lancamentos.
  const { tenantId, isSuperAdmin, isMaster } = await checkFinancialPermission(
    userId,
    "transactions",
    "canView",
    claims,
  );

  // Superadmin pode consultar outro tenant (impersonation no dashboard);
  // qualquer outro role SEMPRE usa o tenant do próprio auth context.
  // No "Acessar Painel" o tenant ja e o da empresa vista (middleware de
  // impersonacao); o parametro so vale para o superadmin fora dele.
  const effectiveTenantId =
    isSuperAdmin && !claims?.impersonation && requestedTenantId?.trim()
      ? requestedTenantId.trim()
      : tenantId;

  if (!effectiveTenantId) {
    throw new Error("AUTH_CLAIMS_MISSING_TENANT");
  }

  // O alcance de Lançamentos recorta o resumo como recorta a lista: "só
  // receitas" não soma despesa; "só as minhas vendas" soma pelo vendedor.
  const scope = isMaster || isSuperAdmin ? "all" : await getPageScope(claims, "transactions");
  const sellerId = scope === "mine" ? userId : undefined;
  const none = { paid: 0, pending: 0 };
  const [income, expense] = await Promise.all([
    sumTotalsByType(effectiveTenantId, "income", sellerId),
    scope === "income" ? Promise.resolve(none) : sumTotalsByType(effectiveTenantId, "expense", sellerId),
  ]);

  return {
    totalIncome: income.paid,
    pendingIncome: income.pending,
    totalExpense: expense.paid,
    pendingExpense: expense.pending,
  };
}
