import { describe, expect, it } from "vitest";
import {
  activeMentionQuery,
  filterTasks,
  isMyTask,
  matchPeople,
  mentionedUids,
  sortOpenTasks,
  taskBucket,
  todayInBrazil,
} from "../tasks";
import type { Task } from "@/types/task";

function task(partial: Partial<Task>): Task {
  return {
    id: "t",
    tenantId: "t1",
    title: "Tarefa",
    notes: null,
    dueAt: null,
    assigneeId: null,
    assigneeName: null,
    mentionUids: [],
    clientId: null,
    clientName: null,
    proposalId: null,
    proposalTitle: null,
    leadId: null,
    leadName: null,
    doneAt: null,
    doneBy: null,
    createdBy: "ana",
    createdByName: "Ana",
    createdAt: "2026-09-20T10:00:00.000Z",
    updatedAt: null,
    ...partial,
  };
}

describe("prazo", () => {
  const today = "2026-09-26";
  it("separa atrasada, hoje, próxima, sem prazo e concluída", () => {
    expect(taskBucket(task({ dueAt: "2026-09-25" }), today)).toBe("overdue");
    expect(taskBucket(task({ dueAt: today }), today)).toBe("today");
    expect(taskBucket(task({ dueAt: "2026-09-27" }), today)).toBe("upcoming");
    expect(taskBucket(task({}), today)).toBe("none");
    expect(taskBucket(task({ dueAt: "2026-09-25", doneAt: "x" }), today)).toBe("done");
  });

  it("hoje é o dia de Brasília, não o de UTC", () => {
    expect(todayInBrazil(new Date("2026-09-27T02:00:00.000Z"))).toBe("2026-09-26");
  });

  it("prazo mais próximo primeiro; sem prazo por último", () => {
    const sorted = sortOpenTasks([
      task({ id: "sem" }),
      task({ id: "depois", dueAt: "2026-10-01" }),
      task({ id: "antes", dueAt: "2026-09-27" }),
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["antes", "depois", "sem"]);
  });
});

describe("filtros", () => {
  const tasks = [
    task({ id: "minha", assigneeId: "ana" }),
    task({ id: "sem-responsavel" }),
    task({ id: "para-beto", assigneeId: "beto" }),
    task({ id: "de-beto-para-ana", assigneeId: "ana", createdBy: "beto" }),
    task({ id: "feita", assigneeId: "ana", doneAt: "x" }),
  ];

  it("Minhas: atribuídas a mim, ou criadas por mim sem responsável", () => {
    expect(filterTasks(tasks, "mine", "ana").map((t) => t.id)).toEqual([
      "minha",
      "sem-responsavel",
      "de-beto-para-ana",
    ]);
    expect(isMyTask(task({ assigneeId: "beto" }), "ana")).toBe(false);
  });

  it("Criadas por mim inclui as que passei para outra pessoa", () => {
    expect(filterTasks(tasks, "created", "ana").map((t) => t.id)).toEqual([
      "minha",
      "sem-responsavel",
      "para-beto",
    ]);
  });

  it("Concluídas fica separada das abertas", () => {
    expect(filterTasks(tasks, "done", "ana").map((t) => t.id)).toEqual(["feita"]);
    expect(filterTasks(tasks, "all", "ana")).toHaveLength(4);
  });
});

describe("menção", () => {
  const people = [
    { id: "u-ana", name: "Ana Ribeiro" },
    { id: "u-beto", name: "Beto" },
  ];

  it("vale o que continua escrito", () => {
    expect(mentionedUids("Fala com @Ana Ribeiro e @Beto", people)).toEqual(["u-ana", "u-beto"]);
    expect(mentionedUids("Fala com @Beto", people)).toEqual(["u-beto"]);
    expect(mentionedUids("sem ninguém", people)).toEqual([]);
  });

  it("reconhece o @ que está sendo digitado", () => {
    expect(activeMentionQuery("Avisar @an", 10)).toEqual({ start: 7, query: "an" });
    expect(activeMentionQuery("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("e-mail não abre a lista de pessoas", () => {
    expect(activeMentionQuery("mandar para ana@empresa", 23)).toBeNull();
  });

  it("quebra de linha encerra a menção", () => {
    expect(activeMentionQuery("@ana\nsegue", 10)).toBeNull();
  });

  it("busca por início de qualquer nome, sem acento", () => {
    expect(matchPeople(people, "rib").map((p) => p.id)).toEqual(["u-ana"]);
    expect(matchPeople([{ id: "j", name: "João" }], "joa").map((p) => p.id)).toEqual(["j"]);
  });
});
