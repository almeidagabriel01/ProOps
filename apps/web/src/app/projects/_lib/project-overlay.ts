import type { Project, StageStatus } from "@/types/project";

/**
 * Mudanças que a tela já mostra mas o servidor ainda não confirmou. Sem isto,
 * cada clique (item do checklist, situação, responsável, data) esperava a ida
 * até a API e a volta pelo listener, e a tela parecia travada.
 *
 * Uma entrada sai da camada quando o projeto que chega do listener já mostra
 * o mesmo valor (`pruneOverlay`), ou quando o servidor recusa (a tela volta ao
 * valor real e avisa).
 */

export type OverlayField = "status" | "assigneeId" | "assigneeName" | "startDate" | "dueDate" | "notes";

export interface ProjectOverlay {
  fields: Partial<Pick<Project, OverlayField>>;
  /** stageId -> situação */
  stageStatus: Record<string, StageStatus>;
  /** `${stageId}:${itemId}` -> marcado */
  items: Record<string, boolean>;
}

export const EMPTY_OVERLAY: ProjectOverlay = { fields: {}, stageStatus: {}, items: {} };

export const itemKey = (stageId: string, itemId: string) => `${stageId}:${itemId}`;

export function isOverlayEmpty(overlay: ProjectOverlay): boolean {
  return (
    Object.keys(overlay.fields).length === 0 &&
    Object.keys(overlay.stageStatus).length === 0 &&
    Object.keys(overlay.items).length === 0
  );
}

export function applyOverlay(project: Project, overlay: ProjectOverlay): Project {
  if (isOverlayEmpty(overlay)) return project;
  return {
    ...project,
    ...overlay.fields,
    stages: project.stages.map((stage) => {
      const status = overlay.stageStatus[stage.id];
      const touched = stage.checklist.some((item) => itemKey(stage.id, item.id) in overlay.items);
      if (status === undefined && !touched) return stage;
      return {
        ...stage,
        status: status ?? stage.status,
        checklist: touched
          ? stage.checklist.map((item) => {
              const done = overlay.items[itemKey(stage.id, item.id)];
              return done === undefined ? item : { ...item, done };
            })
          : stage.checklist,
      };
    }),
  };
}

/** Tira da camada o que o servidor já confirmou (o valor real bate com o pendente). */
export function pruneOverlay(project: Project, overlay: ProjectOverlay): ProjectOverlay {
  if (isOverlayEmpty(overlay)) return overlay;
  const fields = { ...overlay.fields };
  for (const key of Object.keys(fields) as OverlayField[]) {
    if ((project[key] ?? null) === (fields[key] ?? null)) delete fields[key];
  }
  const stageStatus = { ...overlay.stageStatus };
  for (const [stageId, status] of Object.entries(stageStatus)) {
    const stage = project.stages.find((s) => s.id === stageId);
    if (!stage || stage.status === status) delete stageStatus[stageId];
  }
  const items = { ...overlay.items };
  for (const [key, done] of Object.entries(items)) {
    const [stageId, itemId] = key.split(":");
    const item = project.stages.find((s) => s.id === stageId)?.checklist.find((i) => i.id === itemId);
    if (!item || item.done === done) delete items[key];
  }
  return { fields, stageStatus, items };
}

/** Remove uma entrada (o servidor recusou): a tela volta ao valor real. */
export function dropFromOverlay(
  overlay: ProjectOverlay,
  entry: { field?: OverlayField[]; stageStatus?: string; item?: string },
): ProjectOverlay {
  const fields = { ...overlay.fields };
  entry.field?.forEach((f) => delete fields[f]);
  const stageStatus = { ...overlay.stageStatus };
  if (entry.stageStatus) delete stageStatus[entry.stageStatus];
  const items = { ...overlay.items };
  if (entry.item) delete items[entry.item];
  return { fields, stageStatus, items };
}
