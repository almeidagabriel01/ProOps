import { describe, expect, it } from "vitest";
import { computeProgress, currentStage, filterProjects, isProjectLate } from "../projects";
import type { Project, ProjectStage } from "@/types/project";

const stage = (id: string, status: ProjectStage["status"], done: boolean[] = []): ProjectStage => ({
  id,
  name: id,
  status,
  checklist: done.map((d, i) => ({ id: `${id}${i}`, text: "t", done: d })),
  photos: [],
  completedAt: null,
});

const project = (over: Partial<Project>): Project => ({
  id: "p",
  tenantId: "t1",
  proposalId: null,
  proposalTitle: null,
  proposalCode: null,
  clientId: null,
  clientName: null,
  clientPhone: null,
  clientEmail: null,
  address: null,
  title: "Obra",
  status: "active",
  stages: [],
  assigneeId: null,
  assigneeName: null,
  startDate: null,
  dueDate: null,
  notes: null,
  delivery: { status: "none", acceptance: null },
  createdAt: null,
  updatedAt: null,
  ...over,
});

describe("computeProgress", () => {
  it("espelha o backend: percentual pelas etapas e contagem do checklist", () => {
    expect(computeProgress([stage("a", "done", [true]), stage("b", "in_progress", [true, false]), stage("c", "pending")])).toEqual({
      stagesDone: 1,
      stagesTotal: 3,
      checklistDone: 2,
      checklistTotal: 3,
      percent: 33,
    });
    expect(computeProgress([]).percent).toBe(0);
  });
});

describe("currentStage", () => {
  it("é a primeira que falta concluir; obra toda concluída não tem etapa atual", () => {
    expect(currentStage([stage("a", "done"), stage("b", "pending")])?.id).toBe("b");
    expect(currentStage([stage("a", "done")])).toBeNull();
  });
});

describe("filterProjects", () => {
  const list = [
    project({ id: "1", status: "active", assigneeId: "u1" }),
    project({ id: "2", status: "active", assigneeId: "u2" }),
    project({ id: "3", status: "completed", assigneeId: "u1" }),
    project({ id: "4", status: "canceled" }),
  ];

  it("em andamento, só os meus (em andamento), concluídos e todos", () => {
    expect(filterProjects(list, "active", "u1").map((p) => p.id)).toEqual(["1", "2"]);
    expect(filterProjects(list, "mine", "u1").map((p) => p.id)).toEqual(["1"]);
    expect(filterProjects(list, "completed", "u1").map((p) => p.id)).toEqual(["3"]);
    expect(filterProjects(list, "all", "u1")).toHaveLength(4);
  });

  it("sem usuário, \"meus\" fica vazio", () => {
    expect(filterProjects(list, "mine", null)).toEqual([]);
  });
});

describe("isProjectLate", () => {
  it("só obra em andamento com prazo passado", () => {
    expect(isProjectLate({ status: "active", dueDate: "2026-09-01" }, "2026-09-26")).toBe(true);
    expect(isProjectLate({ status: "active", dueDate: "2026-09-26" }, "2026-09-26")).toBe(false);
    expect(isProjectLate({ status: "completed", dueDate: "2026-09-01" }, "2026-09-26")).toBe(false);
    expect(isProjectLate({ status: "active", dueDate: null }, "2026-09-26")).toBe(false);
  });
});
