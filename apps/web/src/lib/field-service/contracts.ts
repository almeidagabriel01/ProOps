import type { ContractCharge, ContractStatus, ContractType, ServiceContract } from "@/types/field-service";

/**
 * Rótulos e regras de tela dos contratos de manutenção. A cobrança em si é do
 * backend (rotina diária `processServiceContracts`); aqui só o que a tela
 * mostra e filtra.
 */

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  monitoring: "Monitoramento",
  maintenance: "Manutenção",
  support: "Suporte",
  pmoc: "PMOC",
  other: "Outro",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  suspended: "Suspenso",
  ended: "Encerrado",
};

export const CONTRACT_STATUS_STYLES: Record<ContractStatus, string> = {
  draft: "border-slate-300 bg-slate-500/10 text-slate-700 dark:border-slate-600 dark:text-slate-300",
  active: "border-emerald-300 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300",
  suspended: "border-amber-300 bg-amber-500/15 text-amber-700 dark:border-amber-500/40 dark:text-amber-300",
  ended: "border-zinc-300 bg-zinc-500/10 text-zinc-600 dark:border-zinc-600 dark:text-zinc-400",
};

export const VISIT_INTERVAL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Todo mês" },
  { value: 2, label: "A cada 2 meses" },
  { value: 3, label: "A cada 3 meses" },
  { value: 4, label: "A cada 4 meses" },
  { value: 6, label: "A cada 6 meses" },
  { value: 12, label: "Uma vez por ano" },
];

export const BILLING_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

export type ContractFilter = "active" | "draft" | "suspended" | "all";

export function filterContracts(contracts: readonly ServiceContract[], filter: ContractFilter): ServiceContract[] {
  if (filter === "all") return [...contracts];
  if (filter === "active") return contracts.filter((c) => c.status === "active");
  if (filter === "draft") return contracts.filter((c) => c.status === "draft");
  return contracts.filter((c) => c.status === "suspended" || c.status === "ended");
}

/** Receita recorrente: a soma das mensalidades dos contratos ativos. */
export function monthlyRecurringRevenue(contracts: readonly ServiceContract[]): number {
  const sum = contracts.filter((c) => c.status === "active").reduce((acc, c) => acc + c.monthlyAmount, 0);
  return Math.round(sum * 100) / 100;
}

/** "2026-10-05" → "05/10/2026". */
export function formatDay(day: string | null): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** A frase do que acontece a seguir, na situação atual do contrato. */
export function nextStepLabel(contract: ServiceContract): string {
  switch (contract.status) {
    case "draft":
      return "Rascunho: ative escolhendo a data de início para começar a cobrar.";
    case "active":
      return contract.nextBillingDate
        ? `Próxima mensalidade vence em ${formatDay(contract.nextBillingDate)} e entra no financeiro dez dias antes.`
        : "Ativo.";
    case "suspended":
      return contract.suspendedReason === "plan"
        ? "Suspenso porque o plano deixou de incluir contratos ou o financeiro. Retome depois de regularizar."
        : "Suspenso: a mensalidade não está sendo lançada.";
    case "ended":
      return "Encerrado: as mensalidades já lançadas continuam no financeiro.";
  }
}

export const CHARGE_STATUS_LABELS: Record<ContractCharge["status"], string> = {
  paid: "Recebida",
  pending: "A receber",
  overdue: "Vencida",
};

/** "Hoje" no fuso de Brasília, para o padrão da data de início. */
export function todayInBrazil(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * O primeiro dia de cobrança a partir do início: o mesmo cálculo do backend
 * (`firstBillingDate` em `contract-model.ts`), para a janela de ativação dizer
 * quando vence a primeira mensalidade.
 */
export function firstBillingDate(startDate: string, billingDay: number): string {
  const [year, month] = startDate.split("-").map(Number);
  const day = String(billingDay).padStart(2, "0");
  const sameMonth = `${year}-${String(month).padStart(2, "0")}-${day}`;
  if (sameMonth >= startDate) return sameMonth;
  const next = new Date(Date.UTC(year, month, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${day}`;
}
