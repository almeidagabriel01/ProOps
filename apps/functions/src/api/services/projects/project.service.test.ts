/**
 * Criação do projeto na aprovação: idempotente pelo id da proposta, respeita o
 * plano e a opção de desligar, e nunca derruba a aprovação.
 */

const tenantHasCapability = jest.fn();
let store: Record<string, Record<string, unknown>>;
let settingsDoc: Record<string, unknown> | undefined;
let tenantDoc: Record<string, unknown>;
const sets: Array<{ id: string; data: Record<string, unknown> }> = [];

jest.mock("../../../lib/tenant-capabilities", () => ({
  tenantHasCapability: (...a: unknown[]) => tenantHasCapability(...a),
}));
jest.mock("../../../lib/frontend-app-url", () => ({ resolveFrontendAppUrl: () => "https://erp.proops.com.br" }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));

jest.mock("../../../init", () => {
  const refFor = (collection: string, id: string) => ({
    id,
    collection,
    get: async () => {
      if (collection === "project_settings") return { exists: !!settingsDoc, data: () => settingsDoc };
      if (collection === "tenants") return { exists: true, data: () => tenantDoc };
      return { exists: !!store[id], data: () => store[id] };
    },
  });
  return {
    db: {
      collection: (name: string) => ({ doc: (id: string) => refFor(name, id) }),
      runTransaction: async (fn: (t: unknown) => Promise<unknown>) =>
        fn({
          get: async (ref: { get: () => Promise<unknown> }) => ref.get(),
          set: (ref: { id: string }, data: Record<string, unknown>) => {
            sets.push({ id: ref.id, data });
            store[ref.id] = data;
          },
        }),
    },
  };
});

import {
  buildProjectShareUrl,
  createProjectFromProposal,
  resolveProjectOnApproval,
} from "./project.service";

const PROPOSAL = {
  title: "Casa da Maria",
  clientId: "c1",
  clientName: "Maria",
  clientAddress: "Rua A, 10",
  proposalCode: "0001226SP",
};

beforeEach(() => {
  jest.clearAllMocks();
  store = {};
  sets.length = 0;
  settingsDoc = undefined;
  tenantDoc = { niche: "cortinas" };
  tenantHasCapability.mockResolvedValue(true);
});

describe("createProjectFromProposal", () => {
  it("cria com o roteiro do nicho, os dados do cliente e o id da proposta", async () => {
    const result = await createProjectFromProposal({ tenantId: "t1", proposalId: "p1", proposal: PROPOSAL, uid: "u1" });
    expect(result).toEqual({ projectId: "proposal_p1", created: true });
    expect(sets[0].data).toMatchObject({
      tenantId: "t1",
      proposalId: "p1",
      clientName: "Maria",
      address: "Rua A, 10",
      status: "active",
      delivery: { status: "none", sharedProjectId: null, acceptance: null },
    });
    expect((sets[0].data.stages as Array<{ name: string }>).map((s) => s.name)).toEqual([
      "Medição",
      "Produção",
      "Instalação",
      "Entrega",
    ]);
  });

  it("aprovar de novo não cria outro", async () => {
    await createProjectFromProposal({ tenantId: "t1", proposalId: "p1", proposal: PROPOSAL, uid: "u1" });
    const again = await createProjectFromProposal({ tenantId: "t1", proposalId: "p1", proposal: PROPOSAL, uid: "u1" });
    expect(again.created).toBe(false);
    expect(sets).toHaveLength(1);
  });
});

describe("resolveProjectOnApproval", () => {
  const call = () =>
    resolveProjectOnApproval({ tenantId: "t1", proposalId: "p1", proposal: PROPOSAL, uid: "u1" });

  it("plano sem projetos (Starter): nem cria nem pergunta", async () => {
    tenantHasCapability.mockResolvedValue(false);
    expect(await call()).toEqual({ createdProjectId: null, suggest: false });
    expect(sets).toHaveLength(0);
    expect(tenantHasCapability).toHaveBeenCalledWith("t1", "projects");
  });

  it("padrão (perguntar): não cria, pede para a tela perguntar", async () => {
    expect(await call()).toEqual({ createdProjectId: null, suggest: true });
    expect(sets).toHaveLength(0);
  });

  it("perguntar, mas a obra já existe (reaprovação): não pergunta de novo", async () => {
    store.proposal_p1 = { tenantId: "t1" };
    expect(await call()).toEqual({ createdProjectId: null, suggest: false });
  });

  it("sempre: cria e devolve o id", async () => {
    settingsDoc = { onApproval: "always" };
    expect(await call()).toEqual({ createdProjectId: "proposal_p1", suggest: false });
    expect(sets).toHaveLength(1);
  });

  it("nunca: nada", async () => {
    settingsDoc = { onApproval: "never" };
    expect(await call()).toEqual({ createdProjectId: null, suggest: false });
    expect(sets).toHaveLength(0);
  });

  it("erro não derruba a aprovação", async () => {
    tenantHasCapability.mockRejectedValue(new Error("boom"));
    await expect(call()).resolves.toEqual({ createdProjectId: null, suggest: false });
  });
});

it("o link de entrega aponta para a página pública do ERP", () => {
  expect(buildProjectShareUrl("tok")).toBe("https://erp.proops.com.br/share/project/tok");
});
