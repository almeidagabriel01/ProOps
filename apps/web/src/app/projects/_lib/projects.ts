import type { Project, ProjectStage, ProjectStatus, StageStatus } from "@/types/project";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Em andamento",
  completed: "Concluído",
  canceled: "Cancelado",
};

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  pending: "A fazer",
  in_progress: "Em andamento",
  done: "Concluída",
};

export interface ProjectProgress {
  stagesDone: number;
  stagesTotal: number;
  checklistDone: number;
  checklistTotal: number;
  percent: number;
}

/** Espelha `computeProgress` do backend: o percentual é pelas etapas concluídas. */
export function computeProgress(stages: ProjectStage[]): ProjectProgress {
  const stagesDone = stages.filter((s) => s.status === "done").length;
  const items = stages.flatMap((s) => s.checklist);
  return {
    stagesDone,
    stagesTotal: stages.length,
    checklistDone: items.filter((i) => i.done).length,
    checklistTotal: items.length,
    percent: stages.length === 0 ? 0 : Math.round((stagesDone / stages.length) * 100),
  };
}

/** A etapa em que a obra está: a primeira não concluída. */
export function currentStage(stages: ProjectStage[]): ProjectStage | null {
  return stages.find((s) => s.status !== "done") ?? null;
}

export type ProjectFilter = "active" | "mine" | "completed" | "all";

export function filterProjects(projects: Project[], filter: ProjectFilter, uid: string | null): Project[] {
  switch (filter) {
    case "active":
      return projects.filter((p) => p.status === "active");
    case "mine":
      return projects.filter((p) => p.status === "active" && !!uid && p.assigneeId === uid);
    case "completed":
      return projects.filter((p) => p.status === "completed");
    default:
      return projects;
  }
}

/** Passou do prazo e ainda não foi entregue. `today` no formato YYYY-MM-DD. */
export function isProjectLate(project: Pick<Project, "status" | "dueDate">, today: string): boolean {
  return project.status === "active" && !!project.dueDate && project.dueDate < today;
}
