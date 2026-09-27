import { describe, expect, it } from "vitest";
import {
  EMPTY_OVERLAY,
  applyOverlay,
  dropFromOverlay,
  itemKey,
  pruneOverlay,
  type ProjectOverlay,
} from "../project-overlay";
import type { Project } from "@/types/project";

const project: Project = {
  id: "p1",
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
  stages: [
    {
      id: "s1",
      name: "Instalação",
      status: "pending",
      checklist: [
        { id: "i1", text: "Fixar", done: false },
        { id: "i2", text: "Testar", done: false },
      ],
      photos: [],
      completedAt: null,
    },
  ],
  assigneeId: null,
  assigneeName: null,
  startDate: null,
  dueDate: null,
  notes: null,
  delivery: { status: "none", acceptance: null },
  createdAt: null,
  updatedAt: null,
};

const overlay: ProjectOverlay = {
  fields: { assigneeId: "tec", assigneeName: "Carlos", dueDate: "2026-10-10" },
  stageStatus: { s1: "in_progress" },
  items: { [itemKey("s1", "i1")]: true },
};

describe("applyOverlay", () => {
  it("a tela mostra na hora o item marcado, a etapa, o responsável e a data", () => {
    const view = applyOverlay(project, overlay);
    expect(view.assigneeName).toBe("Carlos");
    expect(view.dueDate).toBe("2026-10-10");
    expect(view.stages[0].status).toBe("in_progress");
    expect(view.stages[0].checklist.map((i) => i.done)).toEqual([true, false]);
  });

  it("sem pendência, devolve o próprio projeto", () => {
    expect(applyOverlay(project, EMPTY_OVERLAY)).toBe(project);
  });
});

describe("pruneOverlay", () => {
  it("o que o servidor confirmou sai; o que ainda não chegou fica", () => {
    const confirmed: Project = {
      ...project,
      assigneeId: "tec",
      assigneeName: "Carlos",
      stages: [
        {
          ...project.stages[0],
          status: "in_progress",
          checklist: [{ id: "i1", text: "Fixar", done: true }, project.stages[0].checklist[1]],
        },
      ],
    };
    expect(pruneOverlay(confirmed, overlay)).toEqual({
      fields: { dueDate: "2026-10-10" },
      stageStatus: {},
      items: {},
    });
  });

  it("limpar um campo (null) conta como confirmado quando o real também está vazio", () => {
    expect(pruneOverlay(project, { ...EMPTY_OVERLAY, fields: { dueDate: null } }).fields).toEqual({});
  });

  it("item ou etapa que sumiu não fica preso na camada", () => {
    const withoutStage = { ...project, stages: [] };
    expect(pruneOverlay(withoutStage, overlay)).toEqual({ fields: overlay.fields, stageStatus: {}, items: {} });
  });
});

describe("dropFromOverlay", () => {
  it("servidor recusou: a entrada sai e a tela volta ao valor real", () => {
    const dropped = dropFromOverlay(overlay, { field: ["assigneeId", "assigneeName"], item: itemKey("s1", "i1") });
    expect(dropped).toEqual({ fields: { dueDate: "2026-10-10" }, stageStatus: { s1: "in_progress" }, items: {} });
    expect(applyOverlay(project, dropped).stages[0].checklist[0].done).toBe(false);
  });
});
