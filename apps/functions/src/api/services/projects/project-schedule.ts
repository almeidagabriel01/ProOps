import { z } from "zod";
import type { ProjectStage, StageSchedule } from "./project-model";

/**
 * Agendamento de uma etapa da obra (medição, instalação...).
 *
 * A data MORA no evento da Agenda (`calendar_events`, com `projectId` e
 * `projectStageId`): arrastar o evento na Agenda, ou mudá-lo no Google, muda a
 * data da etapa. A etapa guarda só um espelho (`stage.schedule`) para quem não
 * tem permissão de Agenda (o técnico) ver a data na obra, e para o cliente ver
 * no portal e na página da entrega. O espelho é regravado em todo caminho que
 * escreve o evento: o agendamento pela obra, a edição e a exclusão na Agenda e
 * a sincronização com o Google.
 *
 * Este arquivo é puro (o portal e a página da entrega o usam sem Firestore); a
 * gravação do espelho fica em `project-schedule-store.ts`.
 */

/** O que o evento precisa ter para virar o espelho da etapa. */
export interface ScheduleSource {
  status: string;
  isAllDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  startMs: number;
  endMs: number;
}

/** Espelho da data na etapa; null quando o evento foi cancelado. */
export function stageScheduleFromEvent(eventId: string, event: ScheduleSource): StageSchedule | null {
  if (event.status === "canceled") return null;
  return {
    eventId,
    isAllDay: event.isAllDay,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    startDate: event.startDate,
    endDate: event.endDate,
    startMs: event.startMs,
    endMs: event.endMs,
  };
}

/** "Instalação: Casa Silva", o título do evento na Agenda. */
export function scheduleEventTitle(stageName: string, projectTitle: string): string {
  return `${stageName.trim()}: ${projectTitle.trim()}`.slice(0, 140);
}

export function scheduleEventDescription(input: {
  clientName?: string | null;
  clientPhone?: string | null;
  assigneeName?: string | null;
  projectUrl: string;
}): string {
  const lines = [
    input.clientName ? `Cliente: ${input.clientName}` : null,
    input.clientPhone ? `Telefone: ${input.clientPhone}` : null,
    input.assigneeName ? `Técnico: ${input.assigneeName}` : null,
    `Obra: ${input.projectUrl}`,
  ];
  return lines.filter(Boolean).join("\n");
}

/** A data da visita mudou (ou é nova): é quando o técnico é avisado. */
export function scheduleChanged(before: StageSchedule | null | undefined, after: StageSchedule | null): boolean {
  if (!after) return false;
  if (!before) return true;
  return before.startMs !== after.startMs || before.endMs !== after.endMs || before.isAllDay !== after.isAllDay;
}

/**
 * A próxima visita da obra para o cliente: a etapa não concluída com a data
 * mais próxima que ainda não passou.
 */
export function nextScheduledStage(
  stages: Array<Pick<ProjectStage, "name" | "status"> & { schedule?: StageSchedule | null }>,
  nowMs: number,
): { stageName: string; schedule: StageSchedule } | null {
  let best: { stageName: string; schedule: StageSchedule } | null = null;
  for (const stage of stages) {
    const schedule = stage.schedule;
    if (!schedule || stage.status === "done" || schedule.endMs < nowMs) continue;
    if (!best || schedule.startMs < best.schedule.startMs) best = { stageName: stage.name, schedule };
  }
  return best;
}

/** O que o cliente vê da data: sem o id do evento. */
export function publicSchedule(schedule: StageSchedule | null | undefined) {
  if (!schedule) return null;
  return {
    isAllDay: schedule.isAllDay,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    startDate: schedule.startDate,
    endDate: schedule.endDate,
  };
}

export const ScheduleStageSchema = z
  .object({
    isAllDay: z.boolean(),
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    startDate: z.string().nullable().optional(),
    endDate: z.string().nullable().optional(),
  })
  .strict();
