import { db } from "../../../init";
import type { ProjectStage, StageSchedule } from "./project-model";

/**
 * Regrava o espelho de uma etapa a partir do evento da Agenda. Só mexe se a
 * etapa ainda aponta para esse evento: um evento antigo, de uma etapa que já
 * foi reagendada ou desmarcada, não pode sobrescrever a data atual.
 */
export async function mirrorStageScheduleFromEvent(params: {
  tenantId: string;
  projectId: string;
  stageId: string;
  eventId: string;
  schedule: StageSchedule | null;
}): Promise<void> {
  const ref = db.collection("projects").doc(params.projectId);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const data = snap.data();
    if (!snap.exists || data?.tenantId !== params.tenantId) return;
    const stages = (data.stages as ProjectStage[]) ?? [];
    const index = stages.findIndex((s) => s.id === params.stageId);
    if (index < 0 || stages[index].schedule?.eventId !== params.eventId) return;
    const copy = [...stages];
    copy[index] = { ...stages[index], schedule: params.schedule };
    t.update(ref, { stages: copy, updatedAt: new Date().toISOString() });
  });
}
