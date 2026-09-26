/**
 * Fluxo de caixa projetado: o saldo das carteiras hoje, mais o que está para
 * entrar, menos o que está para sair, mês a mês. Puro: a tela passa os
 * lançamentos em aberto e o saldo.
 *
 * O cenário mexe só no que está para ENTRAR, que é onde mora a incerteza: a
 * porcentagem que de fato chega e quantos dias depois do vencimento. O que
 * está para sair entra inteiro, no vencimento. Vencido (dos dois lados) conta
 * como se fosse hoje.
 */

export type CashFlowScenarioId = "pessimistic" | "realistic" | "optimistic";

export interface CashFlowScenario {
  /** Quanto das contas a receber de fato entra, em %. */
  receiveRate: number;
  /** Quantos dias depois do vencimento o cliente paga. */
  delayDays: number;
}

export const SCENARIO_LABELS: Record<CashFlowScenarioId, string> = {
  pessimistic: "Pessimista",
  realistic: "Realista",
  optimistic: "Otimista",
};

export const DEFAULT_SCENARIOS: Record<CashFlowScenarioId, CashFlowScenario> = {
  pessimistic: { receiveRate: 80, delayDays: 30 },
  realistic: { receiveRate: 95, delayDays: 15 },
  optimistic: { receiveRate: 100, delayDays: 0 },
};

export const DELAY_OPTIONS = [0, 7, 15, 30, 45, 60, 90];

/** O pedaço de um lançamento em aberto que interessa à projeção. */
export interface OpenItem {
  type: "income" | "expense";
  status?: string;
  amount?: number;
  dueDate?: string | null;
  date?: string;
  extraCosts?: Array<{ amount?: number; status?: string }>;
}

export interface CashFlowMonth {
  key: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
}

export interface CashFlowResult {
  months: CashFlowMonth[];
  startingBalance: number;
  endBalance: number;
  lowest: { key: string; balance: number };
  firstNegative: string | null;
  /** Contas a receber já vencidas, que o cenário trata como se fossem hoje. */
  overdueReceivable: number;
}

/** Hoje em Brasília (UTC-3), `YYYY-MM-DD`. */
export function brazilToday(nowMs = Date.now()): string {
  return new Date(nowMs - 3 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function monthKeys(from: string, count: number): string[] {
  const [y, m] = from.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(y, m - 1 + i, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Os valores em aberto do lançamento: ele (se não pago) e cada custo extra pendente. */
function openAmounts(item: OpenItem): number[] {
  const amounts: number[] = [];
  if (item.status !== "paid") amounts.push(toNumber(item.amount));
  for (const extra of item.extraCosts ?? []) {
    if ((extra.status ?? "pending") !== "paid") amounts.push(toNumber(extra.amount));
  }
  return amounts.filter((a) => a > 0);
}

export function computeCashFlow(params: {
  items: OpenItem[];
  startingBalance: number;
  horizonMonths: number;
  scenario: CashFlowScenario;
  today: string;
}): CashFlowResult {
  const { items, startingBalance, horizonMonths, scenario, today } = params;
  const keys = monthKeys(today.slice(0, 7), horizonMonths);
  const byKey = new Map(keys.map((key) => [key, { income: 0, expense: 0 }]));
  const rate = Math.min(Math.max(scenario.receiveRate, 0), 100) / 100;
  let overdueReceivable = 0;

  for (const item of items) {
    const due = String(item.dueDate || item.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) continue;
    const base = due < today ? today : due;
    for (const amount of openAmounts(item)) {
      if (item.type === "income") {
        if (due < today) overdueReceivable += amount;
        const bucket = byKey.get(addDays(base, scenario.delayDays).slice(0, 7));
        if (bucket) bucket.income += amount * rate;
      } else if (item.type === "expense") {
        const bucket = byKey.get(base.slice(0, 7));
        if (bucket) bucket.expense += amount;
      }
    }
  }

  let balance = startingBalance;
  const months = keys.map((key) => {
    const { income, expense } = byKey.get(key)!;
    balance += income - expense;
    return { key, income: round(income), expense: round(expense), net: round(income - expense), balance: round(balance) };
  });

  const lowest = months.reduce(
    (min, m) => (m.balance < min.balance ? { key: m.key, balance: m.balance } : min),
    { key: months[0]?.key ?? today.slice(0, 7), balance: months[0]?.balance ?? round(startingBalance) },
  );

  return {
    months,
    startingBalance: round(startingBalance),
    endBalance: months.at(-1)?.balance ?? round(startingBalance),
    lowest,
    firstNegative: months.find((m) => m.balance < 0)?.key ?? null,
    overdueReceivable: round(overdueReceivable),
  };
}
