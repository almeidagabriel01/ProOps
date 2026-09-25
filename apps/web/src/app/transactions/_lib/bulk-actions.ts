import type { Transaction } from "@/services/transaction-service";
import { isProposalLinkedTransaction } from "./proposal-transaction";

/** Teto do `POST /v1/transactions/status-batch` (`BATCH_STATUS_MAX_IDS`). */
export const STATUS_BATCH_MAX_IDS = 200;
/** A exclusão em massa faz uma chamada por lançamento; acima disso, dividir. */
export const BULK_DELETE_MAX = 100;

/**
 * Lançamentos selecionados, sem repetição. A seleção também guarda ids de
 * custos extras (que não são lançamentos), e eles ficam de fora aqui.
 */
export function resolveSelectedTransactions(
  pool: Transaction[],
  selectedIds: ReadonlySet<string>,
): Transaction[] {
  const byId = new Map<string, Transaction>();
  for (const t of pool) {
    if (selectedIds.has(t.id) && !byId.has(t.id)) byId.set(t.id, t);
  }
  return Array.from(byId.values());
}

/** Ids a marcar como pagos (os já pagos ficam de fora), em lotes do teto da API. */
export function planBulkMarkPaid(targets: Transaction[]): string[][] {
  const ids = targets.filter((t) => t.status !== "paid").map((t) => t.id);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += STATUS_BATCH_MAX_IDS) {
    chunks.push(ids.slice(i, i + STATUS_BATCH_MAX_IDS));
  }
  return chunks;
}

/**
 * Separa o que pode ser excluído daqui. Lançamento de proposta só sai
 * revertendo a proposta (a mesma regra do diálogo de exclusão individual).
 */
export function planBulkDelete(targets: Transaction[]): {
  deletable: Transaction[];
  skippedProposal: Transaction[];
} {
  const deletable: Transaction[] = [];
  const skippedProposal: Transaction[] = [];
  for (const t of targets) {
    if (isProposalLinkedTransaction(t)) skippedProposal.push(t);
    else deletable.push(t);
  }
  return { deletable, skippedProposal };
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

export interface ExportRow {
  descricao: string;
  tipo: string;
  status: string;
  data: Date | null;
  vencimento: Date | null;
  valor: number;
  carteira: string;
  contato: string;
  categoria: string;
  parcela: string;
}

function toDate(value?: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** Linhas da planilha exportada, na ordem de vencimento (ou data). */
export function buildExportRows(
  targets: Transaction[],
  wallets: Array<{ id: string; name: string }>,
): ExportRow[] {
  const walletName = (wallet?: string) =>
    wallets.find((w) => w.id === wallet || w.name === wallet)?.name ??
    wallet ??
    "";

  return [...targets]
    .sort((a, b) =>
      (a.dueDate || a.date || "").localeCompare(b.dueDate || b.date || ""),
    )
    .map((t) => {
      const signed = t.type === "expense" ? -Math.abs(t.amount) : Math.abs(t.amount);
      return {
        descricao: t.description,
        tipo: t.type === "income" ? "Receita" : "Despesa",
        status: STATUS_LABEL[t.status] ?? t.status,
        data: toDate(t.date),
        vencimento: toDate(t.dueDate),
        valor: signed,
        carteira: walletName(t.wallet),
        contato: t.clientName ?? "",
        categoria: t.category ?? "",
        parcela:
          t.isInstallment && t.installmentNumber && t.installmentCount
            ? `${t.installmentNumber}/${t.installmentCount}`
            : "",
      };
    });
}
