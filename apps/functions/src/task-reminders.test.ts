/**
 * Lembrete de tarefa: prazo hoje (dia de Brasília), para o responsável ou,
 * sem responsável, para quem criou; concluída fica de fora.
 */

let tasks: Array<{ id: string; data: Record<string, unknown> }>;
const queried: unknown[] = [];

jest.mock("./init", () => ({
  db: {
    collection: (name: string) => {
      if (name === "notifications") return { doc: (id: string) => ({ id }) };
      return {
        where: (field: string, _op: string, value: unknown) => {
          queried.push([name, field, value]);
          return {
            limit: () => ({
              get: async () => ({
                docs: tasks
                  .filter((t) => t.data[field] === value)
                  .map((t) => ({ id: t.id, data: () => t.data })),
              }),
            }),
          };
        },
      };
    },
  },
}));

const recipientFields = jest.fn(async (_t: string, _type: string, target: string[]) => ({
  fields: { recipientUids: target, readBy: [] },
  emailRecipients: [],
}));
jest.mock("./api/services/notification.service", () => ({
  NotificationService: { recipientFields: (...a: [string, string, string[]]) => recipientFields(...a) },
}));

import { runTaskReminders } from "./task-reminders";

// 26/09/2026 às 02:00 UTC ainda é dia 25 em Brasília.
const NOW = new Date("2026-09-26T02:00:00.000Z");

function fakeWriter() {
  const sets: Array<{ id: string; data: Record<string, unknown> }> = [];
  return {
    sets,
    writer: {
      set: (ref: { id: string }, data: Record<string, unknown>) => sets.push({ id: ref.id, data }),
    } as unknown as FirebaseFirestore.BulkWriter,
  };
}

beforeEach(() => {
  queried.length = 0;
  tasks = [
    { id: "k1", data: { tenantId: "t1", title: "Ligar", dueAt: "2026-09-25", assigneeId: "beto", createdBy: "ana", doneAt: null } },
    { id: "k2", data: { tenantId: "t1", title: "Sem dono", dueAt: "2026-09-25", assigneeId: null, createdBy: "ana", doneAt: null } },
    { id: "k3", data: { tenantId: "t1", title: "Feita", dueAt: "2026-09-25", assigneeId: "beto", createdBy: "ana", doneAt: "2026-09-24T10:00:00Z" } },
  ];
});

it("usa o dia de Brasília, avisa o responsável ou quem criou e pula a concluída", async () => {
  const { sets, writer } = fakeWriter();
  expect(await runTaskReminders(NOW, writer)).toBe(2);
  expect(queried).toEqual([["tasks", "dueAt", "2026-09-25"]]);
  expect(sets.map((s) => s.id)).toEqual(["task_k1_2026-09-25", "task_k2_2026-09-25"]);
  expect(sets[0].data).toMatchObject({ type: "task_reminder", taskId: "k1", recipientUids: ["beto"] });
  expect(sets[1].data).toMatchObject({ recipientUids: ["ana"] });
});
