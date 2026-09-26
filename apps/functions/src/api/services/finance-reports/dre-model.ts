/**
 * DRE (Demonstrativo do Resultado) a partir dos lançamentos. Puro: o serviço
 * lê o Firestore e passa os documentos crus.
 *
 * Cada lançamento cai numa linha pela CATEGORIA, e cada categoria pertence a
 * um GRUPO do DRE (`DreGroup`), escolhido pela empresa na lista de categorias.
 * Categoria que não está na lista (texto antigo, "Comissao" automática, lista
 * apagada) vai para o grupo padrão do tipo: receita em Receita bruta, despesa
 * em Despesas operacionais. Sem categoria, a linha é "Sem categoria".
 */

export type TransactionKind = "income" | "expense";

export type DreGroup = "revenue" | "other_income" | "deduction" | "cost" | "operating" | "other_expense";

export const DRE_GROUPS: Record<DreGroup, { kind: TransactionKind; label: string }> = {
  revenue: { kind: "income", label: "Receita bruta" },
  other_income: { kind: "income", label: "Outras receitas" },
  deduction: { kind: "expense", label: "Impostos e deduções" },
  cost: { kind: "expense", label: "Custos" },
  operating: { kind: "expense", label: "Despesas operacionais" },
  other_expense: { kind: "expense", label: "Outras despesas" },
};

export const DEFAULT_GROUP: Record<TransactionKind, DreGroup> = { income: "revenue", expense: "operating" };

export type DreBasis = "cash" | "accrual";

export const NO_CATEGORY = "Sem categoria";

/** "Mão de Obra " e "mao de obra" são a mesma categoria. */
export function normalizeCategoryName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export interface CategoryRef {
  name: string;
  kind: TransactionKind;
  group: DreGroup;
}

/** Linha de uma categoria: valor por mês (`YYYY-MM`) e total. */
export interface DreCategoryLine {
  name: string;
  byMonth: Record<string, number>;
  total: number;
}

export interface DreGroupBlock {
  group: DreGroup;
  label: string;
  byMonth: Record<string, number>;
  total: number;
  categories: DreCategoryLine[];
}

export interface DreResult {
  basis: DreBasis;
  months: string[];
  groups: Record<DreGroup, DreGroupBlock>;
  /** Subtotais do DRE, por mês e total. */
  totals: Record<"netRevenue" | "grossProfit" | "operatingResult" | "result", { byMonth: Record<string, number>; total: number }>;
  /** Lançamentos considerados (para a tela avisar quando o período veio vazio). */
  count: number;
}

type Doc = Record<string, unknown>;

/** Meses de `from` a `to` (inclusive), `YYYY-MM`. */
export function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const months: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

/** Data (`YYYY-MM-DD`) de um ISO em horário de Brasília (UTC-3, sem horário de verão). */
export function brazilDateOf(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
  return new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Quando o dinheiro entrou ou saiu. Lançamento que mudou para pago tem
 * `paidAt`; o que já nasceu pago não tem, e aí vale a data do lançamento.
 */
export function cashDateOf(tx: Doc): string {
  const paidAt = str(tx.paidAt);
  return paidAt ? brazilDateOf(paidAt) : str(tx.date).slice(0, 10);
}

/**
 * Os valores de um lançamento que entram no DRE, cada um com o mês em que
 * conta. Custo extra herda tipo e categoria do lançamento; no caixa conta só
 * se pago, na data de pagamento do lançamento (não há data própria).
 */
export function dreEntriesOf(tx: Doc, basis: DreBasis): Array<{ month: string; amount: number }> {
  const entries: Array<{ month: string; amount: number }> = [];
  const extras = Array.isArray(tx.extraCosts) ? (tx.extraCosts as Doc[]) : [];
  if (basis === "accrual") {
    const month = str(tx.date).slice(0, 7);
    if (!month) return entries;
    entries.push({ month, amount: toNumber(tx.amount) });
    for (const extra of extras) entries.push({ month, amount: toNumber(extra.amount) });
    return entries;
  }
  const month = cashDateOf(tx).slice(0, 7);
  if (!month) return entries;
  if (tx.status === "paid") entries.push({ month, amount: toNumber(tx.amount) });
  for (const extra of extras) {
    if (extra.status === "paid") entries.push({ month, amount: toNumber(extra.amount) });
  }
  return entries;
}

function emptyByMonth(months: string[]): Record<string, number> {
  return Object.fromEntries(months.map((m) => [m, 0]));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeDre(params: {
  transactions: Doc[];
  categories: CategoryRef[];
  basis: DreBasis;
  from: string;
  to: string;
}): DreResult {
  const { transactions, categories, basis } = params;
  const months = monthsBetween(params.from, params.to);
  const inRange = new Set(months);
  const lookup = new Map<string, CategoryRef>();
  for (const category of categories) lookup.set(`${category.kind}:${normalizeCategoryName(category.name)}`, category);

  const groups = Object.fromEntries(
    (Object.keys(DRE_GROUPS) as DreGroup[]).map((group) => [
      group,
      { group, label: DRE_GROUPS[group].label, byMonth: emptyByMonth(months), total: 0, categories: [] as DreCategoryLine[] },
    ]),
  ) as Record<DreGroup, DreGroupBlock>;
  const lines = new Map<string, DreCategoryLine>();
  let count = 0;

  for (const tx of transactions) {
    const kind = tx.type === "income" || tx.type === "expense" ? tx.type : null;
    if (!kind) continue;
    const entries = dreEntriesOf(tx, basis).filter((entry) => inRange.has(entry.month) && entry.amount !== 0);
    if (entries.length === 0) continue;
    count += 1;

    const rawName = str(tx.category).trim();
    const known = rawName ? lookup.get(`${kind}:${normalizeCategoryName(rawName)}`) : undefined;
    const group = known?.group ?? DEFAULT_GROUP[kind];
    const name = known?.name ?? (rawName || NO_CATEGORY);
    const lineKey = `${group}:${normalizeCategoryName(name)}`;
    let line = lines.get(lineKey);
    if (!line) {
      line = { name, byMonth: emptyByMonth(months), total: 0 };
      lines.set(lineKey, line);
      groups[group].categories.push(line);
    }
    for (const entry of entries) {
      line.byMonth[entry.month] += entry.amount;
      line.total += entry.amount;
      groups[group].byMonth[entry.month] += entry.amount;
      groups[group].total += entry.amount;
    }
  }

  for (const block of Object.values(groups)) {
    block.total = round(block.total);
    for (const m of months) block.byMonth[m] = round(block.byMonth[m]);
    for (const line of block.categories) {
      line.total = round(line.total);
      for (const m of months) line.byMonth[m] = round(line.byMonth[m]);
    }
    block.categories.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  }

  const subtotal = (fn: (m: string | null) => number) => ({
    byMonth: Object.fromEntries(months.map((m) => [m, round(fn(m))])),
    total: round(fn(null)),
  });
  const v = (group: DreGroup, m: string | null) => (m ? groups[group].byMonth[m] : groups[group].total);
  const netRevenue = (m: string | null) => v("revenue", m) - v("deduction", m);
  const grossProfit = (m: string | null) => netRevenue(m) - v("cost", m);
  const operatingResult = (m: string | null) => grossProfit(m) - v("operating", m);
  const result = (m: string | null) => operatingResult(m) + v("other_income", m) - v("other_expense", m);

  return {
    basis,
    months,
    groups,
    totals: {
      netRevenue: subtotal(netRevenue),
      grossProfit: subtotal(grossProfit),
      operatingResult: subtotal(operatingResult),
      result: subtotal(result),
    },
    count,
  };
}
