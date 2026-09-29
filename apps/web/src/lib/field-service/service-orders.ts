import type {
  ServiceOrder,
  ServiceOrderItem,
  ServiceOrderPriority,
  ServiceOrderStatus,
  ServiceOrderType,
} from "@/types/field-service";

export const TYPE_LABELS: Record<ServiceOrderType, string> = {
  corrective: "Corretiva",
  preventive: "Preventiva",
  installation: "Instalação",
  inspection: "Vistoria",
};

export const PRIORITY_LABELS: Record<ServiceOrderPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

export const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  open: "Aberta",
  scheduled: "Agendada",
  in_progress: "Em atendimento",
  completed: "Concluída",
  canceled: "Cancelada",
};

/** Classes do selo de status, com o par claro e escuro. */
export const STATUS_TONES: Record<ServiceOrderStatus, string> = {
  open: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  scheduled: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  canceled: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

export type ServiceOrderFilter = "open" | "mine" | "completed" | "all";

export function isClosed(order: Pick<ServiceOrder, "status">): boolean {
  return order.status === "completed" || order.status === "canceled";
}

export function filterOrders(
  orders: readonly ServiceOrder[],
  filter: ServiceOrderFilter,
  uid: string | null,
): ServiceOrder[] {
  switch (filter) {
    case "open":
      return orders.filter((o) => !isClosed(o));
    case "mine":
      return orders.filter((o) => !isClosed(o) && uid !== null && o.technicianUids.includes(uid));
    case "completed":
      return orders.filter((o) => o.status === "completed");
    default:
      return [...orders];
  }
}

/**
 * Ordem da fila de trabalho: a próxima visita primeiro; sem agenda, a mais
 * urgente; empate pela mais antiga, que está esperando há mais tempo.
 */
export function sortQueue(orders: readonly ServiceOrder[]): ServiceOrder[] {
  const rank: Record<ServiceOrderPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return [...orders].sort((a, b) => {
    if (a.scheduledStart && b.scheduledStart) return a.scheduledStart.localeCompare(b.scheduledStart);
    if (a.scheduledStart) return -1;
    if (b.scheduledStart) return 1;
    return (
      rank[a.priority] - rank[b.priority] || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""))
    );
  });
}

/** Mesma conta do backend (`computeOrderTotals`), para a tela mostrar antes de salvar. */
export function orderTotal(items: readonly ServiceOrderItem[]): number {
  return Math.round(items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) * 100) / 100;
}

/** "2026-09-29T13:00:00.000Z" -> "29/09, 10:00" em Brasília. */
export function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ScheduleFields {
  /** YYYY-MM-DD em Brasília. */
  date: string;
  /** HH:mm em Brasília. */
  time: string;
  durationMin: number;
}

export const DURATIONS = [30, 60, 90, 120, 180, 240, 480];

/** Data, hora e duração (Brasília, UTC-3) para início e fim em ISO. */
export function scheduleToIso(fields: ScheduleFields): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || !/^\d{2}:\d{2}$/.test(fields.time)) return null;
  const start = new Date(`${fields.date}T${fields.time}:00-03:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + fields.durationMin * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** O inverso de `scheduleToIso`, para abrir o formulário com a agenda gravada. */
export function isoToSchedule(start: string | null, end: string | null): ScheduleFields {
  const empty = { date: "", time: "08:00", durationMin: 60 };
  if (!start) return empty;
  const begin = new Date(start);
  if (Number.isNaN(begin.getTime())) return empty;
  const local = new Date(begin.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const finish = end ? new Date(end).getTime() : NaN;
  const durationMin = Number.isNaN(finish) ? 60 : Math.max(15, Math.round((finish - begin.getTime()) / 60_000));
  return { date: local.slice(0, 10), time: local.slice(11, 16), durationMin };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

/** Garantia vencida, vencendo em até 30 dias ou em dia. */
export function warrantyState(warrantyUntil: string | null, today: string): "none" | "expired" | "expiring" | "valid" {
  if (!warrantyUntil) return "none";
  if (warrantyUntil < today) return "expired";
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  return warrantyUntil <= limit.toISOString().slice(0, 10) ? "expiring" : "valid";
}
