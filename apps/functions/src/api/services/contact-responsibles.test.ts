/**
 * Quem cuida do cliente: o responsável da equipe e os parceiros externos. Os
 * ids vêm do navegador; o que não pode passar é pessoa de outra empresa,
 * contato de outra empresa, ou contato que não é vendedor nem arquiteto.
 */

const users: Record<string, Record<string, unknown>> = {};
const clients: Record<string, Record<string, unknown>> = {};

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        id,
        name,
        get: async () => {
          const store = name === "users" ? users : clients;
          return { id, exists: id in store, data: () => store[id] };
        },
      }),
    }),
    getAll: async (...refs: Array<{ id: string }>) =>
      refs.map((ref) => ({ id: ref.id, exists: ref.id in clients, data: () => clients[ref.id] })),
  },
}));

import {
  contactResponsiblesErrorMessage,
  resolvePartnerContactIds,
  resolveResponsibleMember,
} from "./contact-responsibles";

async function reason(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return contactResponsiblesErrorMessage(error);
  }
}

beforeEach(() => {
  for (const store of [users, clients]) for (const key of Object.keys(store)) delete store[key];
  users.ana = { tenantId: "t1", name: "Ana", role: "MEMBER" };
  users.dono = { tenantId: "t1", name: "Dono", role: "MASTER" };
  users.outra = { tenantId: "t2", name: "Outra", role: "MASTER" };
  users.sa = { tenantId: "t1", name: "Suporte", role: "SUPERADMIN" };
  clients.arq = { tenantId: "t1", name: "Arquiteta", types: ["arquiteto"] };
  clients.vend = { tenantId: "t1", name: "Vendedor", types: ["cliente", "vendedor"] };
  clients.cli = { tenantId: "t1", name: "Cliente", types: ["cliente"] };
  clients.alheio = { tenantId: "t2", name: "De fora", types: ["arquiteto"] };
});

describe("resolveResponsibleMember", () => {
  it("membro ou dono da empresa vale, com o nome", async () => {
    await expect(resolveResponsibleMember("t1", "ana")).resolves.toEqual({ id: "ana", name: "Ana" });
    await expect(resolveResponsibleMember("t1", "dono")).resolves.toEqual({ id: "dono", name: "Dono" });
  });

  it("pessoa de outra empresa, superadmin ou inexistente é recusada", async () => {
    const esperado = "O responsável escolhido não é da sua empresa.";
    expect(await reason(resolveResponsibleMember("t1", "outra"))).toBe(esperado);
    expect(await reason(resolveResponsibleMember("t1", "sa"))).toBe(esperado);
    expect(await reason(resolveResponsibleMember("t1", "fantasma"))).toBe(esperado);
  });
});

describe("resolvePartnerContactIds", () => {
  it("aceita vendedor e arquiteto da empresa, sem repetir", async () => {
    await expect(resolvePartnerContactIds("t1", ["arq", "vend", "arq", " "])).resolves.toEqual(["arq", "vend"]);
  });

  it("tira o próprio contato da lista", async () => {
    await expect(resolvePartnerContactIds("t1", ["arq", "vend"], "vend")).resolves.toEqual(["arq"]);
  });

  it("lista vazia não consulta nada", async () => {
    await expect(resolvePartnerContactIds("t1", [])).resolves.toEqual([]);
  });

  it("contato que não é parceiro, de outra empresa ou inexistente é recusado", async () => {
    const esperado =
      "Parceiro inválido: escolha vendedores ou arquitetos cadastrados nos seus contatos.";
    expect(await reason(resolvePartnerContactIds("t1", ["cli"]))).toBe(esperado);
    expect(await reason(resolvePartnerContactIds("t1", ["arq", "alheio"]))).toBe(esperado);
    expect(await reason(resolvePartnerContactIds("t1", ["sumiu"]))).toBe(esperado);
  });

  it("mais de dez parceiros é recusado", async () => {
    const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);
    expect(await reason(resolvePartnerContactIds("t1", ids))).not.toBeNull();
  });
});
