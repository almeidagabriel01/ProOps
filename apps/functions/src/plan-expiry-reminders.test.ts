/**
 * Aviso de plano acabando: os marcos, o texto e a rotina, que não duplica
 * aviso nem e-mail ao rodar de novo no mesmo dia.
 */

type Doc = Record<string, unknown>;
type Filter = [string, string, unknown];
let users: Record<string, Doc>;
let tenants: Record<string, Doc>;
let notifications: Record<string, Doc>;
const emails: Doc[] = [];
const userQueries: Filter[][] = [];

jest.mock("./api/services/notification.service", () => ({
  NotificationService: {
    recipientFields: async () => ({ fields: { recipientUids: ["dono"], readBy: [] }, emailRecipients: ["dono"] }),
    sendNotificationEmails: async (notification: Doc) => {
      emails.push(notification);
    },
  },
}));
jest.mock("./init", () => {
  const matches = (d: Doc, [f, op, v]: Filter) => {
    if (op === "==") return d[f] === v;
    if (op === "in") return (v as unknown[]).includes(d[f]);
    const value = String(d[f] ?? "");
    if (op === ">=") return value >= String(v);
    if (op === "<") return value < String(v);
    return false;
  };
  const query = (source: () => Record<string, Doc>, name: string, filters: Filter[]) => ({
    where: (f: string, op: string, v: unknown) => query(source, name, [...filters, [f, op, v]]),
    limit: () => query(source, name, filters),
    get: async () => {
      if (name === "users") userQueries.push(filters);
      const docs = Object.entries(source())
        .filter(([, d]) => filters.every((filter) => matches(d, filter)))
        .map(([id, d]) => ({ id, data: () => d }));
      return { docs };
    },
  });
  return {
    db: {
      collection: (name: string) => {
        if (name === "notifications") {
          return {
            doc: (id: string) => ({
              create: async (data: Doc) => {
                if (notifications[id]) throw Object.assign(new Error("exists"), { code: 6 });
                notifications[id] = data;
              },
            }),
          };
        }
        const source = () => (name === "users" ? users : tenants);
        return { where: (f: string, op: string, v: unknown) => query(source, name, [[f, op, v]]) };
      },
    },
  };
});

import { planExpiryMilestone, planExpiryText, runPlanExpiryReminders } from "./plan-expiry-reminders";

// 2027-09-07 12:00 em Brasília.
const NOW = new Date("2027-09-07T15:00:00Z");

function manualUser(currentPeriodEnd: string, extra: Doc = {}): Doc {
  return {
    tenantId: "t1",
    isManualSubscription: true,
    subscriptionStatus: "active",
    currentPeriodEnd,
    ...extra,
  };
}

beforeEach(() => {
  users = {};
  tenants = {};
  notifications = {};
  emails.length = 0;
  userQueries.length = 0;
});

describe("marcos", () => {
  it.each([
    [30, "d30"],
    [15, "d15"],
    [7, "d7"],
    [1, "d1"],
    [0, null],
    [29, null],
    [31, null],
    [-1, "expired_1"],
    [-6, "expired_6"],
    [-2, null],
    [-7, null],
    [-8, null],
  ])("manual: %i dias → %s", (remaining, expected) => {
    expect(planExpiryMilestone("manual", remaining)).toBe(expected);
  });

  it.each([
    [7, "cancel_d7"],
    [1, "cancel_d1"],
    [30, null],
    [15, null],
    [-1, null],
  ])("cancelamento agendado no Stripe: %i dias → %s", (remaining, expected) => {
    expect(planExpiryMilestone("stripe_cancel", remaining)).toBe(expected);
  });
});

describe("texto", () => {
  it("antes de vencer diz a data e manda falar com a ProOps", () => {
    expect(planExpiryText("manual", "2027-09-14", 7)).toEqual({
      title: "Seu plano vence em 7 dias",
      message: "O plano da sua empresa vale até 14/09/2027. Para renovar, assine pelo cartão em Perfil, Planos, ou fale com a ProOps.",
    });
    expect(planExpiryText("manual", "2027-09-08", 1).title).toBe("Seu plano vence amanhã");
  });

  it("depois de vencer diz até quando vai o acesso", () => {
    expect(planExpiryText("manual", "2027-09-14", -1).message).toBe(
      "O plano da sua empresa venceu em 14/09/2027. O acesso continua até 21/09/2027. Para renovar, assine pelo cartão em Perfil, Planos, ou fale com a ProOps.",
    );
    expect(planExpiryText("manual", "2027-09-14", -6)).toEqual({
      title: "Seu acesso termina amanhã",
      message:
        "O plano da sua empresa venceu em 14/09/2027, e o acesso ao ERP vai até amanhã, 21/09/2027. Para renovar, assine pelo cartão em Perfil, Planos, ou fale com a ProOps.",
    });
  });

  it("cancelamento agendado manda reativar pelo perfil", () => {
    expect(planExpiryText("stripe_cancel", "2027-09-14", 7)).toEqual({
      title: "Sua assinatura termina em 7 dias",
      message:
        "O cancelamento que você agendou encerra a assinatura em 14/09/2027. Para continuar usando o ERP, reative em Perfil, Assinatura.",
    });
  });

  it("nenhum texto usa travessão", () => {
    for (const remaining of [30, 1, -1, -6]) {
      expect(JSON.stringify(planExpiryText("manual", "2027-09-14", remaining))).not.toContain("—");
    }
    expect(JSON.stringify(planExpiryText("stripe_cancel", "2027-09-14", 7))).not.toContain("—");
  });
});

describe("runPlanExpiryReminders", () => {
  it("contrato manual em D-7 avisa na central e por e-mail", async () => {
    users.u1 = manualUser("2027-09-14");

    expect(await runPlanExpiryReminders(NOW)).toBe(1);
    expect(notifications["plan_expiry_t1_2027-09-14_d7"]).toMatchObject({
      tenantId: "t1",
      type: "system",
      title: "Seu plano vence em 7 dias",
      recipientUids: ["dono"],
      isRead: false,
    });
    expect(emails).toHaveLength(1);
  });

  it("data gravada como ISO da meia-noite UTC conta pelo dia do contrato", async () => {
    users.u1 = manualUser("2027-09-14T00:00:00.000Z");
    await runPlanExpiryReminders(NOW);
    expect(Object.keys(notifications)).toEqual(["plan_expiry_t1_2027-09-14_d7"]);
  });

  it("rodar de novo no mesmo dia não duplica a notificação nem o e-mail", async () => {
    users.u1 = manualUser("2027-09-14");
    await runPlanExpiryReminders(NOW);
    expect(await runPlanExpiryReminders(NOW)).toBe(0);
    expect(emails).toHaveLength(1);
  });

  it("renovar a data recomeça os marcos", async () => {
    users.u1 = manualUser("2027-09-14");
    await runPlanExpiryReminders(NOW);
    users.u1 = manualUser("2027-10-07");
    expect(await runPlanExpiryReminders(NOW)).toBe(1);
    expect(notifications["plan_expiry_t1_2027-10-07_d30"]).toBeDefined();
  });

  it("fora dos marcos não avisa", async () => {
    users.u1 = manualUser("2027-09-20");
    expect(await runPlanExpiryReminders(NOW)).toBe(0);
  });

  it("vencido há um dia, ainda em carência, avisa até quando vai o acesso", async () => {
    users.u1 = manualUser("2027-09-06", { subscriptionStatus: "past_due" });
    await runPlanExpiryReminders(NOW);
    expect(notifications["plan_expiry_t1_2027-09-06_expired_1"]).toMatchObject({ title: "Seu plano venceu" });
  });

  it("a consulta cobre da carência até o último marco", async () => {
    await runPlanExpiryReminders(NOW);
    expect(userQueries[0]).toEqual(
      expect.arrayContaining([
        ["isManualSubscription", "==", true],
        ["subscriptionStatus", "in", ["active", "past_due"]],
        ["currentPeriodEnd", ">=", "2027-08-31"],
        ["currentPeriodEnd", "<", "2027-10-08"],
      ]),
    );
  });

  it("cancelamento agendado no Stripe avisa em D-7", async () => {
    tenants.t2 = { cancelAtPeriodEnd: true, subscriptionStatus: "active", currentPeriodEnd: "2027-09-14T18:20:00.000Z" };
    await runPlanExpiryReminders(NOW);
    expect(notifications["plan_expiry_t2_2027-09-14_cancel_d7"]).toMatchObject({
      title: "Sua assinatura termina em 7 dias",
    });
  });

  it("assinatura Stripe que renova sozinha não recebe nada", async () => {
    tenants.t2 = { cancelAtPeriodEnd: false, subscriptionStatus: "active", currentPeriodEnd: "2027-09-14T18:20:00.000Z" };
    expect(await runPlanExpiryReminders(NOW)).toBe(0);
  });

  it("tenant manual com cancelAtPeriodEnd sobrando não ganha o aviso do Stripe", async () => {
    tenants.t1 = { cancelAtPeriodEnd: true, isManualSubscription: true, subscriptionStatus: "active", currentPeriodEnd: "2027-09-14" };
    expect(await runPlanExpiryReminders(NOW)).toBe(0);
  });
});
