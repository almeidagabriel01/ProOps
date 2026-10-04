import { addDays, todayInBrazil } from "../api/services/field-service/contract-model";

export { addDays, todayInBrazil };

/**
 * Fase de uma assinatura com data de fim fixa: o plano dado pelo painel do
 * superadmin (contrato manual). Puro, usado pelo cron
 * `checkManualSubscriptions`, pelo painel e pelo aviso de vencimento, para os
 * três nunca discordarem.
 *
 * Dias no fuso de Brasília, com a data do contrato INCLUSIVA: "vence em 14/09"
 * é acesso normal até o fim do dia 14. Depois vêm 7 dias de carência (15 a 21),
 * e no dia 22 o plano é encerrado.
 */

export const MANUAL_GRACE_DAYS = 7;

export type ManualPhase = "active" | "past_due" | "canceled";

const DAY_RE = /^(\d{4}-\d{2}-\d{2})/;

/**
 * O dia do contrato (`YYYY-MM-DD`) de uma data gravada. O painel grava
 * `YYYY-MM-DD` no usuário e o writer grava o ISO dessa mesma data à meia-noite
 * UTC no tenant; nos dois casos o dia certo são os dez primeiros caracteres.
 * Converter o ISO para Brasília daria o dia anterior.
 */
export function periodEndDay(value: unknown): string | null {
  if (typeof value === "string") {
    const match = DAY_RE.exec(value.trim());
    if (match) return match[1];
    return value.trim() ? periodEndDay(new Date(value)) : null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const toDate = (value as { toDate?: () => Date } | null)?.toDate;
  if (typeof toDate === "function") return periodEndDay(toDate.call(value));
  return null;
}

/** Dias de `from` até `to` (negativo quando `to` já passou). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function manualPhase(endDay: string, today: string): ManualPhase {
  const remaining = daysBetween(today, endDay);
  if (remaining >= 0) return "active";
  if (-remaining <= MANUAL_GRACE_DAYS) return "past_due";
  return "canceled";
}

/** Último dia de acesso da carência. */
export function graceLastDay(endDay: string): string {
  return addDays(endDay, MANUAL_GRACE_DAYS);
}

/**
 * `pastDueSince` do contrato: meia-noite de Brasília do dia seguinte ao fim.
 * A carência de 7 dias do backend e do front conta a partir dele, então ela
 * termina junto com o dia `graceLastDay`, não importa a hora em que o cron
 * rodou. Sem esse campo os dois tratam o atraso como carência já vencida e
 * bloqueiam no primeiro dia.
 */
export function pastDueSinceFor(endDay: string): string {
  return `${addDays(endDay, 1)}T03:00:00.000Z`;
}
