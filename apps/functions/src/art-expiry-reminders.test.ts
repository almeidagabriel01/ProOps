/**
 * Aviso de ART vencendo: os marcos, o texto e a rotina, que não duplica
 * aviso nem e-mail ao rodar de novo no mesmo dia.
 */

type Doc = Record<string, unknown>;
let responsibles: Record<string, Doc>;
let notifications: Record<string, Doc>;
const emails: Doc[] = [];
let rangeFilters: Array<[string, string, unknown]> = [];

jest.mock("./api/services/notification.service", () => ({
  NotificationService: {
    recipientFields: async () => ({ fields: { recipientUids: ["dono"], readBy: [] }, emailRecipients: ["dono"] }),
    sendNotificationEmails: async (notification: Doc) => {
      emails.push(notification);
    },
  },
}));
jest.mock("./init", () => {
  const query = (filters: Array<[string, string, unknown]>) => ({
    where: (f: string, op: string, v: unknown) => query([...filters, [f, op, v]]),
    limit: () => query(filters),
    get: async () => {
      rangeFilters = filters;
      const docs = Object.entries(responsibles)
        .filter(([, d]) =>
          filters.every(([f, op, v]) => {
            const value = String(d[f] ?? "");
            return op === ">=" ? value >= String(v) : value <= String(v);
          }),
        )
        .map(([id, d]) => ({ id, data: () => d }));
      return { docs };
    },
  });
  return {
    db: {
      collection: (name: string) =>
        name === "notifications"
          ? {
              doc: (id: string) => ({
                create: async (data: Doc) => {
                  if (notifications[id]) throw Object.assign(new Error("exists"), { code: 6 });
                  notifications[id] = data;
                },
              }),
            }
          : { where: (f: string, op: string, v: unknown) => query([[f, op, v]]) },
    },
  };
});

import { artReminderMilestone, artReminderText, runArtExpiryReminders } from "./art-expiry-reminders";

// 2026-10-03 12:00 em Brasília.
const NOW = new Date("2026-10-03T15:00:00Z");

beforeEach(() => {
  responsibles = {};
  notifications = {};
  emails.length = 0;
});

describe("marcos", () => {
  it.each([
    [30, "d30"],
    [15, "d15"],
    [7, "d7"],
    [1, "d1"],
    [29, null],
    [0, null],
    [31, null],
    [-1, "expired_1"],
    [-8, "expired_8"],
    [-2, null],
    [-85, "expired_85"],
    [-92, null],
  ])("%i dias → %s", (remaining, expected) => {
    expect(artReminderMilestone(remaining)).toBe(expected);
  });
});

it("o texto diz quanto falta ou há quanto venceu, e onde atualizar", () => {
  expect(artReminderText("Carla", 1)).toEqual({
    title: "ART vencendo",
    message: expect.stringContaining("A ART de Carla vence em 1 dia."),
  });
  const expired = artReminderText("Carla", -8);
  expect(expired.title).toBe("ART vencida");
  expect(expired.message).toContain("venceu há 8 dias");
  expect(expired.message).toContain("Configurações, Responsáveis técnicos");
  expect(expired.message).not.toMatch(/—/);
});

describe("rotina", () => {
  it("avisa no marco, com e-mail, e não repete no mesmo dia", async () => {
    responsibles = {
      rt1: { tenantId: "t1", name: "Carla", artValidUntil: "2026-10-10", active: true },
      rt2: { tenantId: "t1", name: "Beto", artValidUntil: "2026-10-20", active: true },
      rt3: { tenantId: "t2", name: "Dani", artValidUntil: "2026-09-25", active: true },
    };
    expect(await runArtExpiryReminders(NOW)).toBe(2);
    expect(Object.keys(notifications).sort()).toEqual([
      "art_rt1_2026-10-10_d7",
      "art_rt3_2026-09-25_expired_8",
    ]);
    expect(notifications["art_rt1_2026-10-10_d7"]).toMatchObject({
      tenantId: "t1",
      type: "system",
      title: "ART vencendo",
      recipientUids: ["dono"],
      isRead: false,
    });
    expect(emails).toHaveLength(2);

    expect(await runArtExpiryReminders(NOW)).toBe(0);
    expect(emails).toHaveLength(2);
  });

  it("responsável desativado ou sem data não é avisado", async () => {
    responsibles = {
      off: { tenantId: "t1", name: "Off", artValidUntil: "2026-10-10", active: false },
      semData: { tenantId: "t1", name: "Sem", artValidUntil: null, active: true },
    };
    expect(await runArtExpiryReminders(NOW)).toBe(0);
  });

  it("renovar a ART recomeça os marcos, porque a validade entra no id", async () => {
    responsibles = { rt1: { tenantId: "t1", name: "Carla", artValidUntil: "2026-10-10", active: true } };
    await runArtExpiryReminders(NOW);
    responsibles.rt1.artValidUntil = "2026-11-02";
    expect(await runArtExpiryReminders(NOW)).toBe(1);
    expect(Object.keys(notifications)).toContain("art_rt1_2026-11-02_d30");
  });

  it("consulta só a janela que pode gerar aviso", async () => {
    await runArtExpiryReminders(NOW);
    expect(rangeFilters).toEqual([
      ["artValidUntil", ">=", "2026-07-05"],
      ["artValidUntil", "<=", "2026-11-02"],
    ]);
  });
});
