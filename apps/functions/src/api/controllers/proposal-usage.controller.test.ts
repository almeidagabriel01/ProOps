/**
 * GET /v1/proposals/usage: "este contato, produto ou serviço está em alguma
 * proposta?", antes da exclusão. Era uma consulta direta no Firestore, e as
 * rules passaram a exigir a permissão de ver propostas; o membro que cuida do
 * catálogo ou dos contatos pergunta à API, que responde só o booleano.
 *
 * O critério do índice `productRefs` veio do front junto: só vale quando toda
 * proposta da empresa já o tem; antes do backfill, varre os itens.
 */

import type { Request, Response } from "express";

let permissionDocs: Record<string, Record<string, Record<string, unknown>>>;
let proposalDocs: Array<Record<string, unknown>>;
let countTotal: number;
let countIndexed: number;
const wheres: unknown[][] = [];
let failQueries = false;

jest.mock("../../lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock("../../init", () => {
  const makeQuery = (filters: unknown[][]): unknown => ({
    where: (...args: unknown[]) => {
      wheres.push(args);
      return makeQuery([...filters, args]);
    },
    limit: () => makeQuery(filters),
    select: () => makeQuery(filters),
    count: () => ({
      get: async () => {
        if (failQueries) throw new Error("offline");
        const indexedOnly = filters.some((f) => f[0] === "productRefsIndexed");
        return { data: () => ({ count: indexedOnly ? countIndexed : countTotal }) };
      },
    }),
    get: async () => {
      if (failQueries) throw new Error("offline");
      const matches = proposalDocs.filter((d) =>
        filters.every(([field, op, value]) => {
          if (op === "array-contains") {
            return Array.isArray(d[field as string]) && (d[field as string] as unknown[]).includes(value);
          }
          return d[field as string] === value;
        }),
      );
      return {
        empty: matches.length === 0,
        docs: matches.map((d) => ({ data: () => d })),
      };
    },
  });
  return {
    auth: {},
    db: {
      collection: (name: string) => {
        if (name === "users") {
          return {
            doc: (uid: string) => ({
              collection: () => ({
                doc: (pageId: string) => ({
                  get: async () => {
                    const data = permissionDocs[uid]?.[pageId];
                    return { exists: !!data, data: () => data };
                  },
                }),
              }),
            }),
          };
        }
        if (name === "proposals") return makeQuery([]);
        throw new Error(`coleção inesperada: ${name}`);
      },
    },
  };
});

import { getProposalUsage } from "./proposal-usage.controller";

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: Record<string, unknown> };
}

function fakeReq(query: Record<string, string>, role = "MEMBER", uid = "u1") {
  return { query, user: { uid, tenantId: "t1", role } } as unknown as Request;
}

beforeEach(() => {
  wheres.length = 0;
  failQueries = false;
  permissionDocs = {};
  countTotal = 2;
  countIndexed = 2;
  proposalDocs = [
    {
      tenantId: "t1",
      clientId: "c1",
      productRefs: ["product:p1", "service:s1"],
      products: [{ productId: "p1" }, { productId: "s1", itemType: "service" }],
    },
    { tenantId: "t2", clientId: "c9", productRefs: ["product:p9"], products: [{ productId: "p9" }] },
  ];
});

describe("permissão", () => {
  it("membro de produtos (sem propostas) consulta produto", async () => {
    permissionDocs = { u1: { products: { canView: true, canDelete: true } } };
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "product", id: "p1" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ used: true });
  });

  it("membro de contatos consulta contato", async () => {
    permissionDocs = { u1: { clients: { canView: true } } };
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "client", id: "c1" }), res);
    expect(res.body).toEqual({ used: true });
  });

  it("membro de serviços consulta serviço", async () => {
    permissionDocs = { u1: { services: { canView: true } } };
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "service", id: "s1" }), res);
    expect(res.body).toEqual({ used: true });
  });

  it("membro com a permissão de propostas consulta qualquer tipo", async () => {
    permissionDocs = { u1: { proposals: { canView: true } } };
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "client", id: "c1" }), res);
    expect(res.statusCode).toBe(200);
  });

  it("técnico (só OS, equipamentos e agenda) leva 403", async () => {
    permissionDocs = {
      u1: { service_orders: { canView: true }, equipment: { canView: true }, calendar: { canView: true } },
    };
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "product", id: "p1" }), res);
    expect(res.statusCode).toBe(403);
    expect(wheres).toHaveLength(0);
  });

  it("membro de produtos não consulta contato", async () => {
    permissionDocs = { u1: { products: { canView: true } } };
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "client", id: "c1" }), res);
    expect(res.statusCode).toBe(403);
  });

  it("master consulta sem doc de permissão", async () => {
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "product", id: "p1" }, "MASTER", "dono"), res);
    expect(res.body).toEqual({ used: true });
  });

  it("parâmetros inválidos dão 400", async () => {
    const queries: Record<string, string>[] = [
      { kind: "lead", id: "x" },
      { kind: "product" },
      { kind: "product", id: "  " },
    ];
    for (const query of queries) {
      const res = fakeRes();
      await getProposalUsage(fakeReq(query, "MASTER"), res);
      expect(res.statusCode).toBe(400);
    }
  });
});

describe("consulta", () => {
  it("contato: filtra pela empresa de quem pergunta", async () => {
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "client", id: "c9" }, "MASTER"), res);
    expect(res.body).toEqual({ used: false });
    expect(wheres).toContainEqual(["tenantId", "==", "t1"]);
  });

  it("empresa toda indexada: usa productRefs", async () => {
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "service", id: "s1" }, "MASTER"), res);
    expect(res.body).toEqual({ used: true });
    expect(wheres).toContainEqual(["productRefs", "array-contains", "service:s1"]);
  });

  it("serviço com o mesmo id de um produto não conta como produto", async () => {
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "product", id: "s1" }, "MASTER"), res);
    expect(res.body).toEqual({ used: false });
  });

  it("antes do backfill: varre os itens e ainda acha o uso", async () => {
    countIndexed = 1;
    proposalDocs = [{ tenantId: "t1", products: [{ productId: "p9" }, { productId: "p1", itemType: "product" }] }];
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "product", id: "p1" }, "MASTER"), res);
    expect(res.body).toEqual({ used: true });
    expect(wheres).not.toContainEqual(["productRefs", "array-contains", "product:p1"]);
  });

  it("falha na consulta dá 500 (o front bloqueia a exclusão)", async () => {
    failQueries = true;
    const res = fakeRes();
    await getProposalUsage(fakeReq({ kind: "product", id: "p1" }, "MASTER"), res);
    expect(res.statusCode).toBe(500);
  });
});
