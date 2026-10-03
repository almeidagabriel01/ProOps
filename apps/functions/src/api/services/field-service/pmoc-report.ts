import {
  PMOC_CATEGORY_LABELS,
  PMOC_FREQUENCY_LABELS,
  type PmocItem,
} from "../../../shared/pmoc";

/**
 * O relatório de execução do PMOC: as visitas de um período e o que foi feito
 * de cada item do plano. Puro; quem lê o Firestore é `pmoc-document.ts`.
 *
 * Uma visita é uma OS do contrato (`contractId`). O item conta como feito
 * quando a linha `pmoc_<id>` do checklist foi marcada numa OS concluída.
 */

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Até dois anos por relatório: o PMOC se apresenta por ano. */
export const MAX_REPORT_DAYS = 731;

export interface ReportPeriod {
  from: string;
  to: string;
}

function shiftDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * O período pedido, ou os últimos 12 meses. Datas fora do formato, invertidas
 * ou um intervalo maior que o teto caem no padrão, em vez de dar erro: o link
 * é aberto pela fiscalização, que não precisa ver uma tela de erro.
 */
export function normalizeReportPeriod(from: unknown, to: unknown, today: string): ReportPeriod {
  const fallback = { from: shiftDays(today, -364), to: today };
  if (typeof from !== "string" || typeof to !== "string") return fallback;
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || from > to) return fallback;
  const span = (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000;
  if (span > MAX_REPORT_DAYS) return fallback;
  return { from, to };
}

/** Dia da visita no fuso de Brasília: a conclusão, senão a saída, senão o agendado. */
export function visitDay(order: Record<string, unknown>): string | null {
  for (const key of ["completedAt", "checkOutAt", "scheduledStart"]) {
    const value = order[key];
    if (typeof value !== "string" || !value) continue;
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) continue;
    return new Date(ms - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  return null;
}

export interface ChecklistEntry {
  id: string;
  text: string;
  done: boolean;
}

export interface ReportVisit {
  code: string;
  day: string | null;
  status: string;
  technicianName: string | null;
  checklist: Array<{ text: string; done: boolean }>;
  doneCount: number;
  report: string | null;
  signedBy: string | null;
}

/** As visitas do período, da mais antiga para a mais nova. Cancelada não entra. */
export function reportVisits(orders: ReadonlyArray<Record<string, unknown>>, period: ReportPeriod): ReportVisit[] {
  return orders
    .filter((order) => order.status !== "canceled")
    .map((order) => ({ order, day: visitDay(order) }))
    .filter(({ day }) => day !== null && day >= period.from && day <= period.to)
    .sort((a, b) => String(a.day).localeCompare(String(b.day)))
    .map(({ order, day }) => {
      const checklist = ((order.checklist as ChecklistEntry[] | undefined) ?? []).map((c) => ({
        text: String(c.text ?? ""),
        done: c.done === true,
      }));
      const signature = order.signature as { name?: unknown } | null | undefined;
      return {
        code: String(order.code ?? ""),
        day,
        status: String(order.status ?? "open"),
        technicianName: typeof order.technicianName === "string" ? order.technicianName : null,
        checklist,
        doneCount: checklist.filter((c) => c.done).length,
        report: typeof order.report === "string" && order.report ? order.report : null,
        signedBy: signature && typeof signature.name === "string" ? signature.name : null,
      };
    });
}

export interface ItemExecution {
  id: string;
  category: string;
  text: string;
  frequency: string;
  timesDone: number;
  lastDoneOn: string | null;
}

/**
 * Cada item do plano com quantas vezes foi feito no período e quando foi a
 * última. Só OS concluída conta: a que está em andamento ainda pode mudar.
 */
export function itemExecutions(
  items: readonly PmocItem[],
  orders: ReadonlyArray<Record<string, unknown>>,
  period: ReportPeriod,
): ItemExecution[] {
  const done = new Map<string, { count: number; last: string | null }>();
  for (const order of orders) {
    if (order.status !== "completed") continue;
    const day = visitDay(order);
    if (!day || day < period.from || day > period.to) continue;
    for (const entry of (order.checklist as ChecklistEntry[] | undefined) ?? []) {
      if (entry.done !== true || typeof entry.id !== "string" || !entry.id.startsWith("pmoc_")) continue;
      const id = entry.id.slice("pmoc_".length);
      const current = done.get(id) ?? { count: 0, last: null };
      current.count += 1;
      if (!current.last || day > current.last) current.last = day;
      done.set(id, current);
    }
  }
  return items.map((item) => ({
    id: item.id,
    category: PMOC_CATEGORY_LABELS[item.category],
    text: item.text,
    frequency: PMOC_FREQUENCY_LABELS[item.frequency],
    timesDone: done.get(item.id)?.count ?? 0,
    lastDoneOn: done.get(item.id)?.last ?? null,
  }));
}
