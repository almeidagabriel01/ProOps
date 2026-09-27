const users: Record<string, Record<string, unknown>> = {};
let linkedClients: Array<{ id: string; data: Record<string, unknown> }> = [];

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: (id: string) => ({
            get: async () => ({ exists: id in users, data: () => users[id] }),
          }),
        };
      }
      const q = {
        where: () => q,
        limit: () => q,
        get: async () => ({ docs: linkedClients.map((c) => ({ id: c.id, data: () => c.data })) }),
      };
      return q;
    },
  },
}));

import { memberLinkErrorMessage, validateMemberLink } from "./contact-member-link";

beforeEach(() => {
  for (const key of Object.keys(users)) delete users[key];
  users.ana = { tenantId: "t1", name: "Ana" };
  users.outra = { tenantId: "t2", name: "Outra" };
  linkedClients = [];
});

async function reason(promise: Promise<void>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return memberLinkErrorMessage(error);
  }
}

it("membro da empresa, ainda sem contato, pode ser ligado", async () => {
  await expect(validateMemberLink("t1", "ana")).resolves.toBeUndefined();
});

it("membro de outra empresa é recusado", async () => {
  expect(await reason(validateMemberLink("t1", "outra"))).toBe("Esse membro não é da sua empresa.");
});

it("membro já ligado a outro contato é recusado, com o nome do contato", async () => {
  linkedClients = [{ id: "c-antigo", data: { name: "Ana Vendas" } }];
  expect(await reason(validateMemberLink("t1", "ana", "c-novo"))).toBe(
    'Esse membro já está ligado ao contato "Ana Vendas".',
  );
});

it("salvar de novo o próprio contato ligado não conta como duplicado", async () => {
  linkedClients = [{ id: "c1", data: { name: "Ana Vendas" } }];
  await expect(validateMemberLink("t1", "ana", "c1")).resolves.toBeUndefined();
});

it("erro desconhecido não vira mensagem de tela", () => {
  expect(memberLinkErrorMessage(new Error("firestore caiu"))).toBeNull();
});
