/**
 * Contratos de manutenção: a mensalidade é lançada uma vez por mês mesmo com
 * a rotina rodando duas vezes, o período suspenso não é cobrado depois, a
 * visita preventiva vira uma OS só, e a empresa que perde o módulo tem o
 * contrato suspenso (nunca apagado) e é avisada.
 */

import type { Request, Response } from "express";

type Doc = Record<string, unknown>;
let store: Record<string, Record<string, Doc>>;
let autoId = 0;
const permissions = new Map<string, boolean>();

jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: async (claims: { role?: string } | undefined, pageId: string, action: string) =>
    ["MASTER", "ADMIN"].includes(String(claims?.role ?? "").toUpperCase()) ||
    permissions.get(`${pageId}.${action}`) === true,
}));
let caps = { fieldService: true, financial: true };
jest.mock("../../lib/tenant-capabilities", () => ({
  tenantHasCapability: async (_t: string, key: "fieldService" | "financial") => caps[key],
  resolveTenantCapabilities: async () => ({ capabilities: { ...caps } }),
}));
const notifications: Doc[] = [];
jest.mock("../services/notification.service", () => ({
  NotificationService: {
    createNotification: async (data: Doc) => {
      notifications.push(data);
    },
  },
}));
const agendaSynced: string[] = [];
const notified: string[] = [];
jest.mock("./field-service.controller", () => ({
  syncOrderAgenda: async (orderId: string) => {
    agendaSynced.push(orderId);
  },
  notifyTechnician: async (p: { orderId: string }) => {
    notified.push(p.orderId);
  },
}));

jest.mock("../../init", () => {
  type Ref = { id: string; path: string };
  const snap = (collection: string, id: string) => {
    const data = store[collection]?.[id];
    return { id, exists: data !== undefined, data: () => data, ref: ref(collection, id) };
  };
  const write = (collection: string, id: string, data: Doc, merge?: boolean) => {
    store[collection] = store[collection] ?? {};
    const current = merge ? { ...(store[collection][id] ?? {}) } : {};
    for (const [key, value] of Object.entries(data)) {
      // "visitPlan.nextVisitDate" é atualização de campo aninhado, como no Firestore.
      if (merge && key.includes(".")) {
        const [head, tail] = key.split(".");
        current[head] = { ...((current[head] as Doc) ?? {}), [tail]: value };
      } else current[key] = value;
    }
    store[collection][id] = current;
  };
  function ref(collection: string, id: string) {
    return {
      id,
      path: `${collection}/${id}`,
      get: async () => snap(collection, id),
      set: async (data: Doc, opts?: { merge?: boolean }) => write(collection, id, data, opts?.merge),
      update: async (data: Doc) => write(collection, id, data, true),
      delete: async () => {
        delete store[collection]?.[id];
      },
    };
  }
  const collectionOf = (r: Ref) => r.path.split("/")[0];
  const query = (name: string, filters: Array<[string, unknown]>, after: string | null, max: number) => ({
    where: (field: string, _op: string, value: unknown) => query(name, [...filters, [field, value]], after, max),
    limit: (n: number) => query(name, filters, after, n),
    startAfter: (doc: { id: string }) => query(name, filters, doc.id, max),
    get: async () => {
      const ids = Object.keys(store[name] ?? {})
        .sort()
        .filter((id) => filters.every(([f, v]) => store[name][id][f] === v))
        .filter((id) => after === null || id > after)
        .slice(0, max);
      const docs = ids.map((id) => snap(name, id));
      return { empty: docs.length === 0, docs };
    },
  });
  const db = {
    collection: (name: string) => ({
      doc: (id?: string) => ref(name, id ?? `auto_${++autoId}`),
      where: (field: string, op: string, value: unknown) => query(name, [], null, 1000).where(field, op, value),
    }),
    getAll: async (...refs: Ref[]) => refs.map((r) => snap(collectionOf(r), r.id)),
    runTransaction: async (fn: (t: unknown) => Promise<unknown>) => {
      const pending: Array<() => void> = [];
      const result = await fn({
        get: async (r: Ref) => snap(collectionOf(r), r.id),
        set: (r: Ref, data: Doc, opts?: { merge?: boolean }) =>
          pending.push(() => write(collectionOf(r), r.id, data, opts?.merge)),
        create: (r: Ref, data: Doc) => {
          if (store[collectionOf(r)]?.[r.id]) throw new Error("ALREADY_EXISTS");
          pending.push(() => write(collectionOf(r), r.id, data));
        },
        update: (r: Ref, data: Doc) => pending.push(() => write(collectionOf(r), r.id, data, true)),
      });
      pending.forEach((apply) => apply());
      return result;
    },
  };
  return { db };
});

import {
  activateServiceContract,
  createServiceContract,
  deleteServiceContract,
  resumeServiceContract,
  suspendServiceContract,
  updateServiceContract,
} from "./service-contracts.controller";
import { runServiceContracts } from "../services/field-service/contract-billing-run";
import { ensureContractFromProposal, resolveContractOnApproval } from "../services/field-service/contract.service";

type MockRes = Response & { statusCode: number; body: unknown };

function mockRes(): MockRes {
  const state = { statusCode: 200, body: undefined as unknown };
  const res = {
    get statusCode() {
      return state.statusCode;
    },
    get body() {
      return state.body;
    },
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      return res;
    },
    send(body: unknown) {
      state.body = body;
      return res;
    },
  };
  return res as unknown as MockRes;
}

function req(opts: { uid?: string; role?: string; tenantId?: string; params?: Doc; body?: Doc }): Request {
  return {
    user: { uid: opts.uid ?? "master", role: opts.role ?? "MASTER", tenantId: opts.tenantId ?? "t1" },
    params: opts.params ?? {},
    body: opts.body ?? {},
    headers: {},
  } as unknown as Request;
}

const LINES = [{ id: "l1", kind: "service", refId: "s1", name: "Monitoramento 24h", quantity: 1, unitPrice: 129 }];

function seed() {
  store = {
    clients: { c1: { tenantId: "t1", name: "Ana", phone: "11999990000", address: "Rua A, 1" } },
    users: { tech: { tenantId: "t1", name: "Téo" }, outsider: { tenantId: "t2", name: "X" } },
    wallets: { w1: { tenantId: "t1", name: "Caixa" }, w2: { tenantId: "t2", name: "Outra" } },
    customer_equipment: { e1: { tenantId: "t1", clientId: "c1", name: "Central de alarme" } },
  };
}

async function createContract(body: Doc = {}) {
  const res = mockRes();
  await createServiceContract(
    req({
      body: {
        clientId: "c1",
        title: "Monitoramento",
        type: "monitoring",
        lines: LINES,
        billingDay: 10,
        wallet: "w1",
        issueNfse: false,
        ...body,
      },
    }),
    res,
  );
  expect(res.statusCode).toBe(201);
  return (res.body as { id: string }).id;
}

async function activate(id: string, startDate: string, extra: Doc = {}) {
  const res = mockRes();
  await activateServiceContract(req({ params: { id }, body: { startDate, ...extra } }), res);
  return res;
}

function contractTransactions() {
  return Object.entries(store.transactions ?? {}).filter(([, tx]) => tx.serviceContractId);
}

beforeEach(() => {
  seed();
  autoId = 0;
  permissions.clear();
  caps = { fieldService: true, financial: true };
  notifications.length = 0;
  agendaSynced.length = 0;
  notified.length = 0;
  jest.useFakeTimers({ now: new Date("2026-10-05T12:00:00Z"), doNotFake: ["nextTick", "setImmediate"] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("criar e editar", () => {
  it("nasce rascunho, numerado, com a mensalidade somada e sem cobrar nada", async () => {
    const id = await createContract();
    expect(store.service_contracts[id]).toMatchObject({
      status: "draft",
      code: "CT-0001",
      monthlyAmount: 129,
      nextBillingDate: null,
      tenantId: "t1",
    });
    expect(contractTransactions()).toHaveLength(0);
  });

  it("recusa carteira de outra empresa e técnico de fora da equipe", async () => {
    const res = mockRes();
    await createServiceContract(
      req({ body: { clientId: "c1", title: "Suporte", type: "support", lines: LINES, billingDay: 5, wallet: "w2", issueNfse: false } }),
      res,
    );
    expect(res.statusCode).toBe(400);

    const res2 = mockRes();
    await createServiceContract(
      req({
        body: {
          clientId: "c1",
          title: "Suporte",
          type: "support",
          lines: LINES,
          billingDay: 5,
          wallet: "w1",
          issueNfse: false,
          visitPlan: { enabled: true, intervalMonths: 3, technicianId: "outsider", checklist: [] },
        },
      }),
      res2,
    );
    expect(res2.statusCode).toBe(400);
  });

  it("membro sem a permissão de Contratos é recusado; com ela, passa", async () => {
    const res = mockRes();
    await createServiceContract(
      req({ role: "MEMBER", uid: "m1", body: { clientId: "c1", title: "Suporte", type: "support", lines: LINES, billingDay: 5, wallet: "w1", issueNfse: false } }),
      res,
    );
    expect(res.statusCode).toBe(403);

    permissions.set("contracts.canCreate", true);
    const ok = mockRes();
    await createServiceContract(
      req({ role: "MEMBER", uid: "m1", body: { clientId: "c1", title: "Suporte", type: "support", lines: LINES, billingDay: 5, wallet: "w1", issueNfse: false } }),
      ok,
    );
    expect(ok.statusCode).toBe(201);
  });

  it("outra empresa não enxerga o contrato", async () => {
    const id = await createContract();
    const res = mockRes();
    await updateServiceContract(req({ tenantId: "t2", params: { id }, body: { title: "Invadido" } }), res);
    expect(res.statusCode).toBe(404);
    expect(store.service_contracts[id].title).toBe("Monitoramento");
  });

  it("só o rascunho se exclui", async () => {
    const id = await createContract();
    await activate(id, "2026-10-05");
    const res = mockRes();
    await deleteServiceContract(req({ params: { id } }), res);
    expect(res.statusCode).toBe(409);
    expect(store.service_contracts[id]).toBeDefined();
  });
});

describe("ativar", () => {
  it("a primeira mensalidade na janela já sai na ativação, no dia de cobrança", async () => {
    const id = await createContract();
    const res = await activate(id, "2026-10-05");
    expect(res.statusCode).toBe(200);
    const txs = contractTransactions();
    expect(txs).toHaveLength(1);
    const [txId, tx] = txs[0];
    expect(txId).toBe(`contract_${id}_202610`);
    expect(tx).toMatchObject({ amount: 129, dueDate: "2026-10-10", status: "pending", wallet: "w1", proposalId: null });
    expect(store.service_contracts[id]).toMatchObject({ status: "active", nextBillingDate: "2026-11-10", lastBilledPeriod: "2026-10" });
  });

  it("sem o financeiro no plano, não ativa (402)", async () => {
    const id = await createContract();
    caps.financial = false;
    const res = await activate(id, "2026-10-05");
    expect(res.statusCode).toBe(402);
    expect(store.service_contracts[id].status).toBe("draft");
  });

  it("não aceita início mais de um mês no passado", async () => {
    const id = await createContract();
    const res = await activate(id, "2026-08-01");
    expect(res.statusCode).toBe(400);
  });

  it("não ativa duas vezes", async () => {
    const id = await createContract();
    await activate(id, "2026-10-05");
    const res = await activate(id, "2026-10-05");
    expect(res.statusCode).toBe(409);
    expect(contractTransactions()).toHaveLength(1);
  });
});

describe("rotina diária", () => {
  it("rodar duas vezes no mesmo dia não cobra em dobro", async () => {
    const id = await createContract({ billingDay: 20 });
    await activate(id, "2026-10-05");
    expect(contractTransactions()).toHaveLength(0);

    jest.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const first = await runServiceContracts({ dryRun: false, cursorId: null });
    const second = await runServiceContracts({ dryRun: false, cursorId: null });
    expect(first.charges).toBe(1);
    expect(second.charges).toBe(0);
    expect(contractTransactions()).toHaveLength(1);
  });

  it("um lançamento do mês que já existe não é regravado e a próxima cobrança avança", async () => {
    const id = await createContract({ billingDay: 20 });
    await activate(id, "2026-10-05");
    store.transactions = { [`contract_${id}_202610`]: { tenantId: "t1", amount: 1, serviceContractId: id, status: "paid" } };

    jest.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const result = await runServiceContracts({ dryRun: false, cursorId: null });
    expect(result).toMatchObject({ charges: 0, alreadyBilled: 1 });
    expect(store.transactions[`contract_${id}_202610`]).toMatchObject({ amount: 1, status: "paid" });
    expect(store.service_contracts[id].nextBillingDate).toBe("2026-11-20");
  });

  it("dryRun conta sem gravar nada", async () => {
    const id = await createContract({ billingDay: 20 });
    await activate(id, "2026-10-05");
    jest.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const result = await runServiceContracts({ dryRun: true, cursorId: null });
    expect(result.charges).toBe(1);
    expect(contractTransactions()).toHaveLength(0);
    expect(store.service_contracts[id].nextBillingDate).toBe("2026-10-20");
  });

  it("empresa que perdeu o módulo: contrato suspenso, nada cobrado, dono avisado", async () => {
    const id = await createContract({ billingDay: 20 });
    await activate(id, "2026-10-05");
    caps.fieldService = false;
    jest.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    const result = await runServiceContracts({ dryRun: false, cursorId: null });
    expect(result.suspended).toBe(1);
    expect(contractTransactions()).toHaveLength(0);
    expect(store.service_contracts[id]).toMatchObject({ status: "suspended", suspendedReason: "plan" });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ type: "service_contract_suspended", serviceContractId: id });
  });

  it("empresa que perdeu o financeiro também é suspensa", async () => {
    const id = await createContract({ billingDay: 20 });
    await activate(id, "2026-10-05");
    caps.financial = false;
    jest.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    await runServiceContracts({ dryRun: false, cursorId: null });
    expect(store.service_contracts[id].status).toBe("suspended");
    expect(String(notifications[0].message)).toContain("financeiro");
  });

  it("contrato com fim: cobra até o fim e encerra", async () => {
    const id = await createContract({ billingDay: 10, endDate: "2026-11-30" });
    await activate(id, "2026-10-05");
    jest.setSystemTime(new Date("2026-11-01T12:00:00Z"));
    await runServiceContracts({ dryRun: false, cursorId: null });
    expect(contractTransactions().map(([txId]) => txId).sort()).toEqual([`contract_${id}_202610`, `contract_${id}_202611`]);
    expect(store.service_contracts[id].status).toBe("ended");
  });
});

describe("suspender e retomar", () => {
  it("o período suspenso não é cobrado depois", async () => {
    const id = await createContract({ billingDay: 10 });
    await activate(id, "2026-10-05");
    await suspendServiceContract(req({ params: { id } }), mockRes());
    expect(store.service_contracts[id].status).toBe("suspended");

    // Suspenso em novembro e dezembro: nada é lançado.
    jest.setSystemTime(new Date("2026-12-15T12:00:00Z"));
    await runServiceContracts({ dryRun: false, cursorId: null });
    expect(contractTransactions()).toHaveLength(1);

    const res = mockRes();
    await resumeServiceContract(req({ params: { id } }), res);
    expect(res.statusCode).toBe(200);
    expect(store.service_contracts[id]).toMatchObject({ status: "active", nextBillingDate: "2027-01-10" });
    expect(contractTransactions().map(([txId]) => txId)).not.toContain(`contract_${id}_202611`);
  });

  it("retomar sem o módulo no plano é recusado", async () => {
    const id = await createContract();
    await activate(id, "2026-10-05");
    await suspendServiceContract(req({ params: { id } }), mockRes());
    caps.fieldService = false;
    const res = mockRes();
    await resumeServiceContract(req({ params: { id } }), res);
    expect(res.statusCode).toBe(402);
  });

  it("mudar o dia de cobrança não cobra de novo o mês já cobrado", async () => {
    const id = await createContract({ billingDay: 10 });
    await activate(id, "2026-10-05");
    await updateServiceContract(req({ params: { id }, body: { billingDay: 25 } }), mockRes());
    expect(store.service_contracts[id].nextBillingDate).toBe("2026-11-25");
  });
});

describe("visitas preventivas", () => {
  it("abre uma OS por visita, leva à Agenda e avança pelo intervalo", async () => {
    const id = await createContract({
      equipmentIds: ["e1"],
      visitPlan: { enabled: true, intervalMonths: 3, technicianId: "tech", checklist: ["Testar sirene", "Trocar bateria"] },
    });
    await activate(id, "2026-10-05", { firstVisitDate: "2026-10-09" });
    const orderId = `contract_${id}_visit_20261009`;
    expect(store.service_orders[orderId]).toMatchObject({
      type: "preventive",
      contractId: id,
      clientId: "c1",
      technicianUids: ["tech"],
      equipmentIds: ["e1"],
      status: "scheduled",
    });
    expect((store.service_orders[orderId].checklist as Doc[]).map((c) => c.text)).toEqual(["Testar sirene", "Trocar bateria"]);
    expect(agendaSynced).toEqual([orderId]);
    expect(notified).toEqual([orderId]);
    expect((store.service_contracts[id].visitPlan as Doc).nextVisitDate).toBe("2027-01-09");

    await runServiceContracts({ dryRun: false, cursorId: null });
    expect(Object.keys(store.service_orders)).toHaveLength(1);
  });

  it("a OS que já existe para a visita não é recriada", async () => {
    const id = await createContract({ visitPlan: { enabled: true, intervalMonths: 1, technicianId: null, checklist: [] } });
    store.service_orders = { [`contract_${id}_visit_20261009`]: { tenantId: "t1", code: "OS-0099" } };
    await activate(id, "2026-10-05", { firstVisitDate: "2026-10-09" });
    expect(store.service_orders[`contract_${id}_visit_20261009`]).toMatchObject({ code: "OS-0099" });
    expect((store.service_contracts[id].visitPlan as Doc).nextVisitDate).toBe("2026-11-09");
  });
});

describe("contrato a partir da proposta", () => {
  const proposal = {
    title: "Segurança da casa",
    clientId: "c1",
    clientName: "Ana",
    products: [
      { productId: "p1", productName: "Câmera", quantity: 4, total: 1200 },
      { productId: "s1", productName: "Monitoramento", itemType: "service", isMonthly: true, quantity: 1, total: 129 },
    ],
  };

  it("nasce um rascunho só, com as linhas de mensalidade", async () => {
    const first = await ensureContractFromProposal({ tenantId: "t1", proposalId: "p9", proposal, wallet: "w1", uid: "master" });
    const again = await ensureContractFromProposal({ tenantId: "t1", proposalId: "p9", proposal, wallet: "w1", uid: "master" });
    expect(first).toBe("proposal_p9");
    expect(again).toBeNull();
    expect(Object.keys(store.service_contracts)).toEqual(["proposal_p9"]);
    expect(store.service_contracts.proposal_p9).toMatchObject({ status: "draft", monthlyAmount: 129, proposalId: "p9" });
  });

  it("proposta sem mensalidade não cria contrato", async () => {
    const created = await ensureContractFromProposal({
      tenantId: "t1",
      proposalId: "p8",
      proposal: { ...proposal, products: [proposal.products[0]] },
      wallet: "w1",
      uid: "master",
    });
    expect(created).toBeNull();
    expect(store.service_contracts).toBeUndefined();
  });
});

describe("contrato na aprovação da proposta", () => {
  const proposal = {
    title: "Segurança da casa",
    clientId: "c1",
    clientName: "Ana",
    installmentsWallet: "Caixa",
    products: [{ productId: "s1", productName: "Monitoramento", itemType: "service", isMonthly: true, quantity: 1, total: 129 }],
  };

  it("nasce com a carteira da proposta, mesmo gravada pelo nome", async () => {
    const id = await resolveContractOnApproval({ tenantId: "t1", proposalId: "p7", proposal, uid: "master" });
    expect(id).toBe("proposal_p7");
    expect(store.service_contracts.proposal_p7).toMatchObject({ wallet: "w1", status: "draft" });
  });

  it("sem carteira na proposta, usa a padrão da empresa", async () => {
    store.wallets.w3 = { tenantId: "t1", name: "Banco", isDefault: true };
    await resolveContractOnApproval({
      tenantId: "t1",
      proposalId: "p6",
      proposal: { ...proposal, installmentsWallet: undefined },
      uid: "master",
    });
    expect(store.service_contracts.proposal_p6.wallet).toBe("w3");
  });

  it("empresa sem o módulo não ganha contrato, e a aprovação segue", async () => {
    caps.fieldService = false;
    expect(await resolveContractOnApproval({ tenantId: "t1", proposalId: "p5", proposal, uid: "master" })).toBeNull();
    expect(store.service_contracts).toBeUndefined();
  });

  it("carteira de outra empresa com o mesmo nome não é usada", async () => {
    await resolveContractOnApproval({
      tenantId: "t1",
      proposalId: "p4",
      proposal: { ...proposal, installmentsWallet: "w2" },
      uid: "master",
    });
    expect(store.service_contracts.proposal_p4.wallet).toBe("");
  });
});
