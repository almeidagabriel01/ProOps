import type {
  TransactionStatus,
  TransactionType,
} from "@/services/transaction-service";

export type TransactionsViewMode = "grouped" | "byDueDate";

export interface TransactionFiltersState {
  searchTerm: string;
  filterType: TransactionType | "all";
  filterStatus: TransactionStatus[];
  filterWallet: string;
  filterStartDate: string;
  filterEndDate: string;
  filterDateType: "date" | "dueDate";
  sortBy: "date" | "created";
  viewMode: TransactionsViewMode;
}

const STATUSES: readonly TransactionStatus[] = ["paid", "pending", "overdue"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Padrão de status de cada aba (spec 2026-07-06): Lista pendentes+atrasados, Agrupados todos. */
export function defaultStatusForView(view: TransactionsViewMode): TransactionStatus[] {
  return view === "byDueDate" ? ["pending", "overdue"] : [];
}

function sameStatuses(a: TransactionStatus[], b: TransactionStatus[]): boolean {
  return a.length === b.length && a.every((s) => b.includes(s));
}

/**
 * Lê do endereço o que estiver lá e for válido; o resto fica com o padrão da
 * tela. `status=todos` representa a escolha explícita de ver todos.
 */
export function parseTransactionFilters(
  params: URLSearchParams,
): Partial<TransactionFiltersState> {
  const result: Partial<TransactionFiltersState> = {};

  const view = params.get("view");
  if (view === "grouped" || view === "byDueDate") result.viewMode = view;

  const q = params.get("q");
  if (q) result.searchTerm = q;

  const type = params.get("tipo");
  if (type === "income" || type === "expense") result.filterType = type;

  const status = params.get("status");
  if (status === "todos") {
    result.filterStatus = [];
  } else if (status) {
    const parsed = status
      .split(",")
      .filter((s): s is TransactionStatus => STATUSES.includes(s as TransactionStatus));
    if (parsed.length > 0) result.filterStatus = Array.from(new Set(parsed));
  }

  const wallet = params.get("carteira");
  if (wallet) result.filterWallet = wallet;

  const from = params.get("de");
  if (from && ISO_DATE.test(from)) result.filterStartDate = from;
  const to = params.get("ate");
  if (to && ISO_DATE.test(to)) result.filterEndDate = to;

  const dateField = params.get("campo");
  if (dateField === "date" || dateField === "dueDate") result.filterDateType = dateField;

  const sort = params.get("ordem");
  if (sort === "date" || sort === "created") result.sortBy = sort;

  return result;
}

/** Chaves do endereço para o estado atual; o padrão da tela vira `null` (sai do endereço). */
export function serializeTransactionFilters(
  state: TransactionFiltersState,
): Record<string, string | null> {
  const defaultStatus = defaultStatusForView(state.viewMode);
  let status: string | null = null;
  if (!sameStatuses(state.filterStatus, defaultStatus)) {
    status = state.filterStatus.length === 0 ? "todos" : state.filterStatus.join(",");
  }

  return {
    view: state.viewMode === "byDueDate" ? null : state.viewMode,
    q: state.searchTerm.trim() || null,
    tipo: state.filterType === "all" ? null : state.filterType,
    status,
    carteira: state.filterWallet || null,
    de: state.filterStartDate || null,
    ate: state.filterEndDate || null,
    campo: state.filterDateType === "dueDate" ? null : state.filterDateType,
    ordem: state.sortBy === "created" ? null : state.sortBy,
  };
}
