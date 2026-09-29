/**
 * Ordens de serviço: o técnico só alcança as OS dele e só mexe na execução,
 * concluir exige assinatura ou motivo, a baixa de estoque não duplica, o
 * cancelamento devolve as peças e só o master reabre.
 */

import type { Request, Response } from "express";

type Doc = Record<string, unknown>;
let store: Record<string, Record<string, Doc>>;
let autoId = 0;
const permissions = new Map<string, boolean>();
const hasPagePermission = jest.fn(
  async (claims: { role?: string } | undefined, pageId: string, action: string) =>
    ["MASTER", "ADMIN"].includes(String(claims?.role ?? "").toUpperCase()) ||
    permissions.get(`${pageId}.${action}`) === true,
);
const savedFiles: string[] = [];
const deletedFiles: string[] = [];

jest.mock("../../lib/auth-helpers", () => ({
  hasPagePermission: (...a: unknown[]) => (hasPagePermission as (...x: unknown[]) => unknown)(...a),
}));
jest.mock("../services/projects/project.service", () => ({
  isStorageOverQuota: async () => false,
}));
let capability = true;
let financial = true;
jest.mock("../../lib/tenant-capabilities", () => ({
  tenantHasCapability: async (_t: string, key: string) => (key === "financial" ? financial : capability),
}));
const createdTransactions: Doc[] = [];
let transactionError: Error | null = null;
jest.mock("../services/transaction.service", () => ({
  TransactionService: {
    createTransaction: async (_uid: string, _user: unknown, dto: Doc) => {
      if (transactionError) throw transactionError;
      createdTransactions.push(dto);
      return { transactionId: `tx_${createdTransactions.length}`, count: 1 };
    },
  },
}));
const rendered: string[] = [];
jest.mock("../services/core-pdf.service", () => ({
  resolveAppBaseUrl: () => "https://erp.test",
  renderPageToPdfBuffer: async ({ url }: { url: string }) => {
    rendered.push(url);
    return Buffer.from("%PDF-1.7 fake");
  },
}));
jest.mock("../../lib/frontend-app-url", () => ({
  resolveFrontendAppUrl: () => "https://erp.test/",
  resolveFrontendAppOrigin: () => "https://erp.test",
}));
const notifications: Doc[] = [];
jest.mock("../services/notification.service", () => ({
  NotificationService: {
    createNotification: async (data: Doc) => {
      notifications.push(data);
    },
  },
}));
const googleDeletes: string[] = [];
jest.mock("./calendar.controller", () => ({
  buildCalendarEventDocument: (p: { input: Doc; tenantId: string; ownerUserId: string; links?: Doc }) => ({
    tenantId: p.tenantId,
    ownerUserId: p.ownerUserId,
    title: p.input.title,
    location: p.input.location,
    startsAt: p.input.startsAt,
    endsAt: p.input.endsAt,
    ...(p.links ?? {}),
  }),
  syncEventToGoogle: async () => ({ enabled: false }),
  deleteEventFromGoogleIfNeeded: async (event: Doc) => {
    googleDeletes.push(String(event.title));
  },
}));
jest.mock("firebase-admin/storage", () => ({
  getStorage: () => ({
    bucket: () => ({
      name: "bucket",
      file: (path: string) => ({
        save: async () => {
          savedFiles.push(path);
        },
        exists: async () => [false],
        delete: async () => {
          deletedFiles.push(path);
        },
      }),
    }),
  }),
}));

jest.mock("../../init", () => {
  const ref = (collection: string, id: string) => ({
    id,
    path: `${collection}/${id}`,
    get: async () => snap(collection, id),
    set: async (data: Doc, opts?: { merge?: boolean }) => write(collection, id, data, opts?.merge),
    update: async (data: Doc) => write(collection, id, data, true),
    delete: async () => {
      delete store[collection]?.[id];
    },
  });
  const snap = (collection: string, id: string) => {
    const data = store[collection]?.[id];
    return { id, exists: data !== undefined, data: () => data, ref: ref(collection, id) };
  };
  const write = (collection: string, id: string, data: Doc, merge?: boolean) => {
    store[collection] = store[collection] ?? {};
    store[collection][id] = merge ? { ...(store[collection][id] ?? {}), ...data } : { ...data };
  };
  type Ref = ReturnType<typeof ref>;
  const collectionOf = (r: Ref) => r.path.split("/")[0];
  const db = {
    collection: (name: string) => ({ doc: (id?: string) => ref(name, id ?? `auto_${++autoId}`) }),
    getAll: async (...refs: Ref[]) => refs.map((r) => snap(collectionOf(r), r.id)),
    runTransaction: async (fn: (t: unknown) => Promise<unknown>) => {
      // Escritas só valem se a transação inteira terminar, como no Firestore.
      const pending: Array<() => void> = [];
      const result = await fn({
        get: async (r: Ref) => snap(collectionOf(r), r.id),
        getAll: async (...refs: Ref[]) => refs.map((r) => snap(collectionOf(r), r.id)),
        set: (r: Ref, data: Doc, opts?: { merge?: boolean }) =>
          pending.push(() => write(collectionOf(r), r.id, data, opts?.merge)),
        update: (r: Ref, data: Doc) => pending.push(() => write(collectionOf(r), r.id, data, true)),
      });
      pending.forEach((apply) => apply());
      return result;
    },
  };
  return { db };
});

import {
  changeServiceOrderStatus,
  completeServiceOrder,
  createServiceOrder,
  createServiceOrderShareLink,
  deleteServiceOrder,
  downloadServiceOrderPdf,
  getSharedServiceOrder,
  launchServiceOrderTransaction,
  reopenServiceOrder,
  updateServiceOrder,
} from "./field-service.controller";

const PNG = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString("base64")}`;

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
    setHeader() {
      return res;
    },
    headersSent: false,
  };
  return res as unknown as MockRes;
}

function req(opts: { uid?: string; role?: string; tenantId?: string; params?: Doc; body?: Doc }): Request {
  return {
    user: { uid: opts.uid ?? "master", role: opts.role ?? "MASTER", tenantId: opts.tenantId ?? "t1" },
    params: opts.params ?? {},
    body: opts.body ?? {},
    headers: { "user-agent": "jest" },
    socket: { remoteAddress: "10.0.0.1" },
  } as unknown as Request;
}

const TECH = { uid: "tec", role: "MEMBER" };

function order(over: Doc = {}): Doc {
  return {
    tenantId: "t1",
    code: "OS-0001",
    clientId: "c1",
    status: "in_progress",
    technicianUids: ["tec"],
    items: [
      { id: "i1", kind: "product", refId: "p1", name: "Capacitor", quantity: 2, unitPrice: 30, fromStock: true },
      { id: "i2", kind: "service", refId: "s1", name: "Visita", quantity: 1, unitPrice: 150, fromStock: false },
    ],
    equipmentIds: ["e1"],
    stockApplied: {},
    stockRevision: 0,
    photos: [],
    ...over,
  };
}

beforeEach(() => {
  autoId = 0;
  capability = true;
  rendered.length = 0;
  notifications.length = 0;
  googleDeletes.length = 0;
  financial = true;
  createdTransactions.length = 0;
  transactionError = null;
  permissions.clear();
  savedFiles.length = 0;
  deletedFiles.length = 0;
  store = {
    tenants: { t1: { name: "Polar Climatização", logoUrl: null, primaryColor: "#1e40af" } },
    clients: { c1: { tenantId: "t1", name: "Ana Souza", phone: "11999990000", address: "Rua A, 10" } },
    users: { tec: { tenantId: "t1", name: "Diego" }, fora: { tenantId: "t2", name: "Outro" } },
    products: { p1: { tenantId: "t1", name: "Capacitor", inventoryValue: 5, inventoryUnit: "unit" } },
    customer_equipment: { e1: { tenantId: "t1", clientId: "c1", name: "Split sala", brand: "LG" } },
    service_orders: {
      o1: order(),
      outra: order({ technicianUids: ["outro"] }),
      alheia: order({ tenantId: "t2" }),
    },
  };
});

describe("criar", () => {
  it("numera em sequência e copia o cliente para a OS", async () => {
    for (const expected of ["OS-0001", "OS-0002"]) {
      const res = mockRes();
      await createServiceOrder(
        req({ body: { clientId: "c1", type: "corrective", title: "Não gela", equipmentIds: ["e1"] } }),
        res,
      );
      expect(res.statusCode).toBe(201);
      expect((res.body as Doc).code).toBe(expected);
    }
    const created = Object.values(store.service_orders).find((o) => o.code === "OS-0002")!;
    expect(created).toMatchObject({
      clientName: "Ana Souza",
      clientPhone: "11999990000",
      address: "Rua A, 10",
      equipmentLabels: ["Split sala (LG)"],
      status: "open",
    });
  });

  it("recusa técnico de outra empresa e equipamento de outro cliente", async () => {
    const tecnico = mockRes();
    await createServiceOrder(
      req({ body: { clientId: "c1", type: "corrective", title: "Não gela", technicianId: "fora" } }),
      tecnico,
    );
    expect(tecnico.statusCode).toBe(400);

    store.customer_equipment.e2 = { tenantId: "t1", clientId: "c9", name: "Outro" };
    const equipamento = mockRes();
    await createServiceOrder(
      req({ body: { clientId: "c1", type: "corrective", title: "Não gela", equipmentIds: ["e2"] } }),
      equipamento,
    );
    expect(equipamento.statusCode).toBe(400);
  });

  it("membro sem permissão de criar é barrado", async () => {
    const res = mockRes();
    await createServiceOrder(req({ ...TECH, body: { clientId: "c1", type: "corrective", title: "Não gela" } }), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("técnico", () => {
  beforeEach(() => permissions.set("service_orders.canEdit", true));

  it("não alcança OS de outro técnico nem de outra empresa", async () => {
    for (const id of ["outra", "alheia"]) {
      const res = mockRes();
      await updateServiceOrder(req({ ...TECH, params: { id }, body: { report: "ok" } }), res);
      expect(res.statusCode).toBe(404);
    }
  });

  it("com o escopo service_orders_all alcança a OS de outro", async () => {
    permissions.set("service_orders_all.canView", true);
    const res = mockRes();
    await updateServiceOrder(req({ ...TECH, params: { id: "outra" }, body: { report: "ok" } }), res);
    expect(res.statusCode).toBe(200);
  });

  it("preenche a execução mas não reatribui nem cancela", async () => {
    const execucao = mockRes();
    await updateServiceOrder(req({ ...TECH, params: { id: "o1" }, body: { report: "Trocado" } }), execucao);
    expect(execucao.statusCode).toBe(200);
    expect(store.service_orders.o1.report).toBe("Trocado");

    const reatribuir = mockRes();
    await updateServiceOrder(req({ ...TECH, params: { id: "o1" }, body: { technicianId: "tec" } }), reatribuir);
    expect(reatribuir.statusCode).toBe(403);

    const cancelar = mockRes();
    await changeServiceOrderStatus(req({ ...TECH, params: { id: "o1" }, body: { status: "canceled" } }), cancelar);
    expect(cancelar.statusCode).toBe(403);
  });

  it("não reabre OS concluída", async () => {
    store.service_orders.o1.status = "completed";
    const res = mockRes();
    await reopenServiceOrder(req({ ...TECH, params: { id: "o1" }, body: { reason: "Faltou peça" } }), res);
    expect(res.statusCode).toBe(403);
  });
});

describe("concluir", () => {
  it("com assinatura: grava quem, quando, IP, hash e dá baixa nas peças", async () => {
    permissions.set("service_orders.canEdit", true);
    const res = mockRes();
    await completeServiceOrder(
      req({ ...TECH, params: { id: "o1" }, body: { signature: { name: "Ana Souza", imageDataUrl: PNG } } }),
      res,
    );
    expect(res.statusCode).toBe(200);
    const done = store.service_orders.o1;
    expect(done.status).toBe("completed");
    expect(done.signature).toMatchObject({ name: "Ana Souza", userAgent: "jest" });
    expect((done.signature as Doc).contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(savedFiles).toEqual(["tenants/t1/service_orders/o1/assinatura-1.png"]);
    expect(store.products.p1.inventoryValue).toBe(3);
    expect(Object.values(store.stock_movements)).toEqual([
      expect.objectContaining({ productId: "p1", quantity: -2, balanceAfter: 3, refId: "o1" }),
    ]);
    expect(store.customer_equipment.e1.lastServiceOrderId).toBe("o1");
  });

  it("sem assinatura exige o motivo", async () => {
    const vazio = mockRes();
    await completeServiceOrder(req({ params: { id: "o1" }, body: {} }), vazio);
    expect(vazio.statusCode).toBe(400);

    const ausente = mockRes();
    await completeServiceOrder(req({ params: { id: "o1" }, body: { noSignatureReason: "Cliente ausente" } }), ausente);
    expect(ausente.statusCode).toBe(200);
    expect(store.service_orders.o1).toMatchObject({ signature: null, noSignatureReason: "Cliente ausente" });
  });

  it("a OS concluída fica travada: nem editar, nem concluir de novo", async () => {
    await completeServiceOrder(req({ params: { id: "o1" }, body: { noSignatureReason: "Cliente ausente" } }), mockRes());
    const editar = mockRes();
    await updateServiceOrder(req({ params: { id: "o1" }, body: { report: "Mudou" } }), editar);
    expect(editar.statusCode).toBe(409);
    const concluir = mockRes();
    await completeServiceOrder(req({ params: { id: "o1" }, body: { noSignatureReason: "De novo" } }), concluir);
    expect(concluir.statusCode).toBe(409);
    expect(store.products.p1.inventoryValue).toBe(3);
  });

  it("estoque negativo é avisado, não bloqueia", async () => {
    store.products.p1.inventoryValue = 1;
    const res = mockRes();
    await completeServiceOrder(req({ params: { id: "o1" }, body: { noSignatureReason: "Cliente ausente" } }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as Doc).negative).toEqual([{ productId: "p1", name: "Capacitor", balance: -1 }]);
  });

  it("produto sem controle de estoque não ganha movimento", async () => {
    delete store.products.p1.inventoryValue;
    await completeServiceOrder(req({ params: { id: "o1" }, body: { noSignatureReason: "Cliente ausente" } }), mockRes());
    expect(store.stock_movements).toBeUndefined();
    expect(store.service_orders.o1.stockApplied).toEqual({ p1: 2 });
  });
});

describe("reabrir e cancelar", () => {
  async function completeThenReopen() {
    await completeServiceOrder(
      req({ params: { id: "o1" }, body: { signature: { name: "Ana Souza", imageDataUrl: PNG } } }),
      mockRes(),
    );
    const res = mockRes();
    await reopenServiceOrder(req({ params: { id: "o1" }, body: { reason: "Faltou uma peça" } }), res);
    return res;
  }

  it("o master reabre, a assinatura sai e fica no histórico", async () => {
    const res = await completeThenReopen();
    expect(res.statusCode).toBe(200);
    const reopened = store.service_orders.o1;
    expect(reopened.status).toBe("in_progress");
    expect(reopened.signature).toBeNull();
    expect((reopened.reopenLog as Doc[])[0]).toMatchObject({ reason: "Faltou uma peça" });
    expect(((reopened.reopenLog as Doc[])[0].previousSignature as Doc).name).toBe("Ana Souza");
  });

  it("concluir de novo com uma peça a mais baixa só a diferença", async () => {
    await completeThenReopen();
    const items = [...(store.service_orders.o1.items as Doc[])];
    items[0] = { ...items[0], quantity: 3 };
    await updateServiceOrder(req({ params: { id: "o1" }, body: { items } }), mockRes());
    await completeServiceOrder(req({ params: { id: "o1" }, body: { noSignatureReason: "Cliente ausente" } }), mockRes());
    expect(store.products.p1.inventoryValue).toBe(2);
    expect(Object.keys(store.stock_movements)).toHaveLength(2);
  });

  it("cancelar a OS reaberta devolve as peças ao estoque", async () => {
    await completeThenReopen();
    const res = mockRes();
    await changeServiceOrderStatus(req({ params: { id: "o1" }, body: { status: "canceled" } }), res);
    expect(res.statusCode).toBe(200);
    expect(store.products.p1.inventoryValue).toBe(5);
    expect(store.service_orders.o1.stockApplied).toEqual({});
  });

  it("não exclui OS que já mexeu no estoque", async () => {
    await completeThenReopen();
    const res = mockRes();
    await deleteServiceOrder(req({ params: { id: "o1" } }), res);
    expect(res.statusCode).toBe(409);
    expect(store.service_orders.o1).toBeDefined();
  });

  it("exclui OS que não mexeu no estoque, com os arquivos", async () => {
    store.service_orders.o1.photos = [{ id: "f1", storagePath: "tenants/t1/service_orders/o1/f1.webp" }];
    const res = mockRes();
    await deleteServiceOrder(req({ params: { id: "o1" } }), res);
    expect(res.statusCode).toBe(200);
    expect(store.service_orders.o1).toBeUndefined();
    expect(deletedFiles).toEqual(["tenants/t1/service_orders/o1/f1.webp"]);
  });
});

describe("link público e PDF", () => {
  async function shareLink(opts: { uid?: string; role?: string; id?: string } = {}) {
    const res = mockRes();
    await createServiceOrderShareLink(req({ ...opts, params: { id: opts.id ?? "o1" } }), res);
    return res;
  }

  it("um link por OS, reaproveitado", async () => {
    const first = await shareLink();
    const second = await shareLink();
    const url = (first.body as { url: string }).url;
    expect(url).toMatch(/^https:\/\/erp\.test\/share\/os\/[A-Za-z0-9_-]{32}$/);
    expect((second.body as { url: string }).url).toBe(url);
    expect(Object.keys(store.shared_service_orders)).toHaveLength(1);
  });

  it("o técnico não gera link de OS de outro", async () => {
    permissions.set("service_orders.canView", true);
    const res = await shareLink({ ...TECH, id: "outra" });
    expect(res.statusCode).toBe(404);
  });

  it("o cliente vê a OS sem IP, navegador, técnico interno nem caminho de arquivo", async () => {
    store.service_orders.o1.signature = {
      name: "Ana Souza",
      document: null,
      imageUrl: "https://files.test/a.png",
      storagePath: "tenants/t1/service_orders/o1/assinatura-1.png",
      signedAt: "2026-09-29T15:00:00.000Z",
      ip: "10.0.0.1",
      userAgent: "jest",
      contentHash: "h",
    };
    const url = (await shareLink()).body as { url: string };
    const token = url.url.split("/").pop()!;
    const res = mockRes();
    await getSharedServiceOrder(req({ params: { token } }), res);
    expect(res.statusCode).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).toContain("Ana Souza");
    expect(body).toContain("Polar Climatização");
    for (const secret of ["10.0.0.1", "jest", "assinatura-1.png", "technicianUids", "stockApplied"]) {
      expect(body).not.toContain(secret);
    }
  });

  it("token desconhecido ou empresa sem o módulo dão o mesmo 404", async () => {
    const unknown = mockRes();
    await getSharedServiceOrder(req({ params: { token: "x".repeat(32) } }), unknown);
    expect(unknown.statusCode).toBe(404);

    const token = ((await shareLink()).body as { url: string }).url.split("/").pop()!;
    capability = false;
    const noPlan = mockRes();
    await getSharedServiceOrder(req({ params: { token } }), noPlan);
    expect(noPlan.statusCode).toBe(404);
  });

  it("o PDF imprime a página pública da OS", async () => {
    const res = mockRes();
    await downloadServiceOrderPdf(req({ params: { id: "o1" } }), res);
    expect(res.statusCode).toBe(200);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toMatch(/^https:\/\/erp\.test\/share\/os\/[A-Za-z0-9_-]+\?print=1$/);
    expect(savedFiles).toContain("tenants/t1/service_orders/o1/pdf/os.pdf");
  });

  it("sem o módulo no plano o PDF é recusado, mesmo pela função pdf", async () => {
    capability = false;
    const res = mockRes();
    await downloadServiceOrderPdf(req({ params: { id: "o1" } }), res);
    expect(res.statusCode).toBe(402);
    expect(rendered).toHaveLength(0);
  });
});

describe("Agenda e aviso ao técnico", () => {
  const scheduled = {
    clientId: "c1",
    type: "preventive",
    title: "Limpeza semestral",
    technicianId: "tec",
    scheduledStart: "2026-10-02T12:00:00.000Z",
    scheduledEnd: "2026-10-02T14:00:00.000Z",
  };

  function eventsOf(orderId: string) {
    return Object.entries(store.calendar_events ?? {}).filter(([, e]) => e.serviceOrderId === orderId);
  }

  it("OS agendada entra na Agenda, ligada a ela, e o técnico é avisado", async () => {
    const res = mockRes();
    await createServiceOrder(req({ body: scheduled }), res);
    const { id } = res.body as { id: string };
    const events = eventsOf(id);
    expect(events).toHaveLength(1);
    expect(events[0][1]).toMatchObject({ startsAt: scheduled.scheduledStart, ownerUserId: "tec" });
    expect(store.service_orders[id].calendarEventId).toBe(events[0][0]);
    expect(notifications).toEqual([
      expect.objectContaining({ type: "service_order_assigned", targetUids: ["tec"], serviceOrderId: id }),
    ]);
  });

  it("remarcar move o mesmo evento e avisa de novo; tirar a data apaga o evento", async () => {
    const res = mockRes();
    await createServiceOrder(req({ body: scheduled }), res);
    const { id } = res.body as { id: string };
    const eventId = store.service_orders[id].calendarEventId;
    notifications.length = 0;

    await updateServiceOrder(
      req({ params: { id }, body: { scheduledStart: "2026-10-03T12:00:00.000Z", scheduledEnd: "2026-10-03T13:00:00.000Z" } }),
      mockRes(),
    );
    expect(eventsOf(id)).toHaveLength(1);
    expect(store.calendar_events[eventId as string].startsAt).toBe("2026-10-03T12:00:00.000Z");
    expect(notifications).toEqual([expect.objectContaining({ title: expect.stringContaining("remarcada") })]);

    await updateServiceOrder(req({ params: { id }, body: { scheduledStart: null, scheduledEnd: null } }), mockRes());
    expect(eventsOf(id)).toHaveLength(0);
    expect(store.service_orders[id]).toMatchObject({ calendarEventId: null, status: "open" });
  });

  it("cancelar tira a visita da Agenda", async () => {
    const res = mockRes();
    await createServiceOrder(req({ body: scheduled }), res);
    const { id } = res.body as { id: string };
    await changeServiceOrderStatus(req({ params: { id }, body: { status: "canceled" } }), mockRes());
    expect(eventsOf(id)).toHaveLength(0);
    expect(googleDeletes).toHaveLength(1);
  });

  it("quem se atribui a própria OS não é avisado de si mesmo", async () => {
    const res = mockRes();
    await createServiceOrder(req({ uid: "tec", role: "MASTER", body: scheduled }), res);
    expect(notifications).toEqual([]);
  });

  it("OS sem data não cria evento", async () => {
    const res = mockRes();
    await createServiceOrder(req({ body: { clientId: "c1", type: "corrective", title: "Não gela" } }), res);
    const { id } = res.body as { id: string };
    expect(eventsOf(id)).toHaveLength(0);
    expect(store.service_orders[id].calendarEventId).toBeUndefined();
  });
});

describe("lançar no financeiro", () => {
  const body = { wallet: "w1", status: "pending", dueDate: "2026-10-10" };
  const launch = async () => {
    const res = mockRes();
    await launchServiceOrderTransaction(req({ params: { id: "o1" }, body }), res);
    return res;
  };

  it("só OS concluída vira lançamento", async () => {
    const res = await launch();
    expect(res.statusCode).toBe(409);
    expect(createdTransactions).toHaveLength(0);
  });

  it("vira uma receita com o total, e só uma vez", async () => {
    store.service_orders.o1.status = "completed";
    store.service_orders.o1.totals = { products: 60, services: 150, total: 210 };
    store.service_orders.o1.title = "Não gela";
    const first = await launch();
    expect(first.statusCode).toBe(201);
    expect(createdTransactions[0]).toMatchObject({
      type: "income",
      amount: 210,
      wallet: "w1",
      status: "pending",
      dueDate: "2026-10-10",
      clientId: "c1",
      category: "Ordens de serviço",
      description: "OS-0001: Não gela",
    });
    expect(store.service_orders.o1).toMatchObject({ transactionId: "tx_1", transactionClaimAt: null });
    const second = await launch();
    expect(second.statusCode).toBe(409);
    expect(createdTransactions).toHaveLength(1);
  });

  it("empresa sem o financeiro leva 402", async () => {
    store.service_orders.o1.status = "completed";
    store.service_orders.o1.totals = { total: 210 };
    financial = false;
    expect((await launch()).statusCode).toBe(402);
  });

  it("sem permissão de lançamentos dá 403 e libera a trava", async () => {
    store.service_orders.o1.status = "completed";
    store.service_orders.o1.totals = { total: 210 };
    transactionError = new Error("Sem permissão financeira.");
    expect((await launch()).statusCode).toBe(403);
    expect(store.service_orders.o1.transactionClaimAt).toBeNull();
    transactionError = null;
    expect((await launch()).statusCode).toBe(201);
  });

  it("OS sem valor não é lançada", async () => {
    store.service_orders.o1.status = "completed";
    store.service_orders.o1.totals = { total: 0 };
    expect((await launch()).statusCode).toBe(400);
  });
});
