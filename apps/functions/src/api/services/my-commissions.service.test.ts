/**
 * "Minhas comissões": a pessoa da equipe vê só as comissões do contato
 * parceiro ligado a ela, sem a permissão do financeiro. O que não pode
 * acontecer: aparecer comissão de outro parceiro, de outra empresa, ou a
 * pessoa sem vínculo receber a lista da empresa.
 */

let clients: Array<{ id: string; data: Record<string, unknown> }> = [];
let commissions: Array<{ id: string; data: Record<string, unknown> }> = [];
const queries: Array<{ collection: string; filters: unknown[][] }> = [];

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => {
      const record = { collection: name, filters: [] as unknown[][] };
      queries.push(record);
      const chain = {
        where(...args: unknown[]) {
          record.filters.push(args);
          return chain;
        },
        orderBy: () => chain,
        limit: () => chain,
        get: async () => {
          const value = (field: string) =>
            record.filters.find((f) => f[0] === field)?.[2];
          const source = name === "clients" ? clients : commissions;
          const docs = source.filter(
            (doc) =>
              doc.data.tenantId === value("tenantId") &&
              (name !== "clients" || doc.data.linkedMemberId === value("linkedMemberId")),
          );
          return { docs: docs.map((doc) => ({ id: doc.id, data: () => doc.data })), empty: docs.length === 0 };
        },
      };
      return chain;
    },
  },
}));

import { getMyCommissions } from "./my-commissions.service";

const commission = (id: string, data: Record<string, unknown>) => ({
  id,
  data: {
    tenantId: "t1",
    isCommission: true,
    dueDate: "2026-10-10",
    status: "pending",
    amount: 100,
    commissionRole: "vendedor",
    ...data,
  },
});

beforeEach(() => {
  queries.length = 0;
  clients = [
    { id: "c-ana", data: { tenantId: "t1", linkedMemberId: "ana", name: "Ana Vendas" } },
    { id: "c-arq", data: { tenantId: "t1", linkedMemberId: "beto", name: "Beto Arquiteto" } },
    { id: "c-outra", data: { tenantId: "t2", linkedMemberId: "ana", name: "Ana em outra empresa" } },
  ];
  commissions = [
    commission("1", { commissionContactId: "c-ana", commissionContactName: "Ana Vendas", amount: 300 }),
    commission("2", { commissionContactId: "c-ana", commissionContactName: "Ana Vendas", amount: 200, status: "paid" }),
    commission("3", { commissionContactId: "c-arq", commissionContactName: "Beto Arquiteto", commissionRole: "arquiteto", amount: 900 }),
    commission("4", { commissionContactId: "c-externo", commissionContactName: "Externo", amount: 50 }),
    commission("5", { tenantId: "t2", commissionContactId: "c-outra", commissionContactName: "Ana em outra empresa", amount: 999 }),
  ];
});

it("vendedor ligado ve so as comissoes dele, separando a receber de recebido", async () => {
  const result = await getMyCommissions("t1", "ana", "2026-10");
  expect(result).toMatchObject({ month: "2026-10", linked: true, aPagar: 300, pago: 200, total: 500 });
  expect(result.partners).toHaveLength(1);
  expect(result.partners[0].contactName).toBe("Ana Vendas");
  expect(result.partners[0].entries.map((e) => e.transactionId).sort()).toEqual(["1", "2"]);
});

it("arquiteto ligado ve as dele", async () => {
  const result = await getMyCommissions("t1", "beto", "2026-10");
  expect(result).toMatchObject({ linked: true, aPagar: 900, total: 900 });
  expect(result.partners[0].role).toBe("arquiteto");
});

it("sem contato ligado: nada, e nem consulta o financeiro", async () => {
  const result = await getMyCommissions("t1", "carla", "2026-10");
  expect(result).toEqual({ month: "2026-10", linked: false, aPagar: 0, pago: 0, total: 0, partners: [] });
  expect(queries.some((q) => q.collection === "transactions")).toBe(false);
});

it("todas as consultas sao do tenant de quem chama, nunca de outra empresa", async () => {
  const result = await getMyCommissions("t1", "ana", "2026-10");
  expect(result.total).toBe(500);
  for (const query of queries) {
    expect(query.filters).toContainEqual(["tenantId", "==", "t1"]);
  }
});

it("a consulta de comissoes e a do mes, no indice do relatorio", async () => {
  await getMyCommissions("t1", "ana", "2026-02");
  const tx = queries.find((q) => q.collection === "transactions");
  expect(tx?.filters).toEqual([
    ["tenantId", "==", "t1"],
    ["isCommission", "==", true],
    ["dueDate", ">=", "2026-02-01"],
    ["dueDate", "<=", "2026-02-28"],
  ]);
});
