/**
 * O alcance ("só os meus") no servidor segue as rules: com "own", o registro
 * de outra pessoa não existe para a API. Sem o doc de permissão, ou sem o
 * campo, vale "all": nenhum membro muda no dia. Dono e administradores
 * alcançam tudo.
 */
const mockPerms: Record<string, Record<string, Record<string, unknown>>> = {};
jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: (uid: string) => ({
        collection: () => ({
          doc: (pageId: string) => ({
            get: async () => {
              const data = mockPerms[uid]?.[pageId];
              return { exists: data !== undefined, data: () => data };
            },
          }),
        }),
      }),
    }),
  },
}));

import { recordInScope, transactionInScope } from "../auth-helpers";

const member = { uid: "vend", role: "MEMBER" };

beforeEach(() => {
  for (const key of Object.keys(mockPerms)) delete mockPerms[key];
});

describe("recordInScope", () => {
  it("sem o doc, ou sem o campo scope, alcança tudo", async () => {
    expect(await recordInScope(member, "proposals", { sellerId: "outra" })).toBe(true);
    mockPerms.vend = { proposals: { canView: true } };
    expect(await recordInScope(member, "proposals", { sellerId: "outra" })).toBe(true);
  });

  it("com 'own', só o que é dele, pelo campo de cada página", async () => {
    mockPerms.vend = {
      proposals: { canView: true, scope: "own" },
      clients: { canView: true, scope: "own" },
      kanban: { canView: true, scope: "own" },
      spreadsheets: { canView: true, scope: "own" },
    };
    expect(await recordInScope(member, "proposals", { sellerId: "vend" })).toBe(true);
    expect(await recordInScope(member, "proposals", { sellerId: "outra" })).toBe(false);
    expect(await recordInScope(member, "proposals", {})).toBe(false);
    expect(await recordInScope(member, "clients", { responsibleMemberId: "vend" })).toBe(true);
    expect(await recordInScope(member, "kanban", { ownerId: "outra" })).toBe(false);
    expect(await recordInScope(member, "spreadsheets", { createdById: "vend" })).toBe(true);
  });

  it("dono e administradores alcançam tudo, mesmo com scope gravado", async () => {
    mockPerms.adm = { proposals: { scope: "own" } };
    expect(await recordInScope({ uid: "adm", role: "ADMIN" }, "proposals", { sellerId: "outra" })).toBe(true);
    expect(await recordInScope({ uid: "dono", role: "MASTER" }, "proposals", { sellerId: "outra" })).toBe(true);
  });
});

describe("transactionInScope", () => {
  it("tudo, só receitas e só as das minhas vendas", async () => {
    expect(await transactionInScope(member, { type: "expense" })).toBe(true);

    mockPerms.vend = { transactions: { canView: true, scope: "income" } };
    expect(await transactionInScope(member, { type: "income" })).toBe(true);
    expect(await transactionInScope(member, { type: "expense", isCommission: true })).toBe(false);

    mockPerms.vend = { transactions: { canView: true, scope: "mine" } };
    expect(await transactionInScope(member, { type: "income", sellerId: "vend" })).toBe(true);
    expect(await transactionInScope(member, { type: "income", sellerId: "outra" })).toBe(false);
  });
});
