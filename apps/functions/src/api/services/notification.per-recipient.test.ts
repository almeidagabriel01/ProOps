/**
 * Central de notificações: cada pessoa vê só o que foi endereçado a ela, lê
 * por conta própria e limpa só da própria central.
 */

const docs = new Map<string, Record<string, unknown>>();
const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
const deletes: string[] = [];
const added: Array<Record<string, unknown>> = [];

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayUnion: (v: string) => ({ op: "union", v }),
    arrayRemove: (v: string) => ({ op: "remove", v }),
  },
}));

jest.mock("../../init", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: (id: string) => ({
        get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
        update: async (data: Record<string, unknown>) => {
          updates.push({ id, data });
        },
        delete: async () => {
          deletes.push(id);
        },
      }),
      add: async (data: Record<string, unknown>) => {
        added.push(data);
        return { id: "novo" };
      },
    })),
  },
}));

const resolveTenantRecipients = jest.fn();
jest.mock("./notification-audience", () => ({
  resolveTenantRecipients: (...a: unknown[]) => resolveTenantRecipients(...a),
}));

const sendEmail = jest.fn();
jest.mock("../../services/email/send-email", () => ({
  sendEmail: (...a: unknown[]) => sendEmail(...a),
}));

jest.mock("../../lib/frontend-app-url", () => ({
  resolveFrontendAppOrigin: () => "https://erp.proops.com.br",
}));

import { NotificationService } from "./notification.service";
import type { NotificationScope } from "../helpers/notification-scope";

const scope: NotificationScope = { kind: "tenant", tenantId: "t1" };
const ana = { uid: "ana", perRecipient: true };
const beto = { uid: "beto", perRecipient: true };

beforeEach(() => {
  docs.clear();
  updates.length = 0;
  deletes.length = 0;
  added.length = 0;
  jest.clearAllMocks();
  sendEmail.mockResolvedValue({ ok: true });
});

describe("leitura por pessoa", () => {
  it("marcar como lida grava só quem leu, sem mexer na leitura dos outros", async () => {
    docs.set("n1", { tenantId: "t1", recipientUids: ["ana", "beto"], readBy: [] });
    await NotificationService.markAsRead("n1", scope, ana);
    expect(updates).toEqual([{ id: "n1", data: { readBy: { op: "union", v: "ana" } } }]);
  });

  it("quem não é destinatário não enxerga a notificação (404, não 403)", async () => {
    docs.set("n1", { tenantId: "t1", recipientUids: ["ana"], readBy: [] });
    await expect(NotificationService.markAsRead("n1", scope, beto)).rejects.toThrow("not found");
    await expect(NotificationService.deleteNotification("n1", scope, beto)).rejects.toThrow(
      "not found",
    );
    expect(updates).toEqual([]);
    expect(deletes).toEqual([]);
  });

  it("outra empresa continua barrada", async () => {
    docs.set("n1", { tenantId: "t2", recipientUids: ["ana"], readBy: [] });
    await expect(NotificationService.markAsRead("n1", scope, ana)).rejects.toThrow("Unauthorized");
  });
});

describe("limpar da própria central", () => {
  it("com outros destinatários, só a pessoa sai; o documento fica", async () => {
    docs.set("n1", { tenantId: "t1", recipientUids: ["ana", "beto"], readBy: ["beto"] });
    await NotificationService.deleteNotification("n1", scope, ana);
    expect(deletes).toEqual([]);
    expect(updates[0].data).toEqual({
      recipientUids: { op: "remove", v: "ana" },
      readBy: { op: "remove", v: "ana" },
    });
  });

  it("o último destinatário apaga o documento", async () => {
    docs.set("n1", { tenantId: "t1", recipientUids: ["ana"], readBy: [] });
    await NotificationService.deleteNotification("n1", scope, ana);
    expect(deletes).toEqual(["n1"]);
  });

  it("na visão da empresa (superadmin) o comportamento antigo segue: apaga", async () => {
    docs.set("n1", { tenantId: "t1", recipientUids: ["ana"], readBy: [] });
    await NotificationService.deleteNotification("n1", scope, { uid: "super", perRecipient: false });
    expect(deletes).toEqual(["n1"]);
  });
});

describe("criação", () => {
  it("grava os destinatários e manda e-mail a quem ligou o tipo", async () => {
    resolveTenantRecipients.mockResolvedValue({
      recipientUids: ["ana", "beto"],
      emailRecipients: [{ uid: "ana", email: "ana@empresa.com" }],
    });

    await NotificationService.createNotification({
      tenantId: "t1",
      type: "proposal_accepted",
      title: "Cliente aceitou a proposta",
      message: "Casa aceitou.",
      proposalId: "p1",
    });

    expect(added[0]).toMatchObject({ recipientUids: ["ana", "beto"], readBy: [], isRead: false });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe("ana@empresa.com");
    expect(email.subject).toBe("Cliente aceitou a proposta");
    // O e-mail leva ao mesmo lugar que o sino.
    expect(email.html).toContain("https://erp.proops.com.br/proposals?aceite=p1");
  });

  it("e-mail que falha não derruba a criação", async () => {
    resolveTenantRecipients.mockResolvedValue({
      recipientUids: ["ana"],
      emailRecipients: [{ uid: "ana", email: "ana@empresa.com" }],
    });
    sendEmail.mockRejectedValue(new Error("resend fora"));

    await expect(
      NotificationService.createNotification({
        tenantId: "t1",
        type: "transaction_paid_online",
        title: "Pagamento recebido",
        message: "ok",
      }),
    ).resolves.toMatchObject({ id: "novo" });
  });

  it("tipo que não sai por e-mail não manda nada, mesmo com destinatário de e-mail", async () => {
    await NotificationService.sendNotificationEmails(
      { tenantId: "t1", type: "transaction_due_reminder", title: "x", message: "y" },
      [{ uid: "ana", email: "ana@empresa.com" }],
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("notificação do sistema (superadmin) não resolve destinatários da empresa", async () => {
    const result = await NotificationService.recipientFields("system", "system");
    expect(result).toEqual({ fields: { recipientUids: [], readBy: [] }, emailRecipients: [] });
    expect(resolveTenantRecipients).not.toHaveBeenCalled();
  });
});
