/**
 * Lembretes do CRM: próxima ação do lead e atividade com prazo hoje viram
 * notificação uma vez por dia; lead fechado e atividade concluída ficam de fora.
 */

let leads: Array<{ id: string; data: Record<string, unknown> }>;
let activities: Array<{ id: string; data: Record<string, unknown> }>;
const queried: Array<{ collection: string; field: string; value: unknown }> = [];

jest.mock("./init", () => ({
  db: {
    collection: (name: string) => {
      if (name === "notifications") return { doc: (id: string) => ({ id }) };
      const source = name === "leads" ? () => leads : () => activities;
      let filter: { field: string; value: unknown } | null = null;
      const q = {
        where: (field: string, _op: string, value: unknown) => {
          filter = { field, value };
          queried.push({ collection: name, field, value });
          return q;
        },
        limit: () => q,
        get: async () => ({
          docs: source()
            .filter((d) => !filter || d.data[filter.field] === filter.value)
            .map((d) => ({ id: d.id, data: () => d.data })),
        }),
      };
      return q;
    },
  },
}));

jest.mock("./api/services/notification.service", () => ({
  NotificationService: {
    recipientFields: async () => ({
      fields: { recipientUids: ["dono", "crm"], readBy: [] },
      emailRecipients: [],
    }),
  },
}));

import { runLeadReminders } from "./lead-reminders";

function fakeWriter() {
  const sets: Array<{ id: string; data: Record<string, unknown> }> = [];
  return {
    sets,
    writer: {
      set: (ref: { id: string }, data: Record<string, unknown>) => sets.push({ id: ref.id, data }),
    } as unknown as FirebaseFirestore.BulkWriter,
  };
}

// 25/09/2026 às 02:00 UTC ainda é dia 24 em Brasília.
const NOW = new Date("2026-09-25T02:00:00.000Z");

beforeEach(() => {
  queried.length = 0;
  leads = [
    { id: "l1", data: { tenantId: "t1", name: "Carla", stage: "contato", nextAction: "Ligar", nextActionAt: "2026-09-24", ownerName: "Ana" } },
    { id: "l2", data: { tenantId: "t1", name: "Perdido", stage: "perdido", nextActionAt: "2026-09-24" } },
    { id: "l3", data: { tenantId: "t1", name: "Amanhã", stage: "novo", nextActionAt: "2026-09-25" } },
  ];
  activities = [
    { id: "a1", data: { tenantId: "t1", leadId: "l1", title: "Mandar fotos", dueAt: "2026-09-24", doneAt: null } },
    { id: "a2", data: { tenantId: "t1", leadId: "l1", title: "Feita", dueAt: "2026-09-24", doneAt: "2026-09-23T10:00:00Z" } },
  ];
});

it("usa o dia de Brasília e ignora lead fechado e atividade concluída", async () => {
  const { sets, writer } = fakeWriter();
  const created = await runLeadReminders(NOW, writer);

  expect(queried).toEqual([
    { collection: "leads", field: "nextActionAt", value: "2026-09-24" },
    { collection: "activities", field: "dueAt", value: "2026-09-24" },
  ]);
  expect(created).toBe(2);
  expect(sets.map((s) => s.id)).toEqual(["lead_l1_2026-09-24", "activity_a1_2026-09-24"]);
  expect(sets[0].data).toMatchObject({
    tenantId: "t1",
    type: "lead_reminder",
    title: "Hoje: Ligar",
    message: "Lead Carla, com Ana.",
    leadId: "l1",
    isRead: false,
    // Só quem vê o CRM recebe, e o lembrete regravado volta como não lido.
    recipientUids: ["dono", "crm"],
    readBy: [],
  });
  expect(sets[1].data).toMatchObject({ type: "lead_reminder", message: "Mandar fotos", leadId: "l1" });
});

it("sem nada para hoje não escreve", async () => {
  leads = [];
  activities = [];
  const { sets, writer } = fakeWriter();
  expect(await runLeadReminders(NOW, writer)).toBe(0);
  expect(sets).toHaveLength(0);
});
