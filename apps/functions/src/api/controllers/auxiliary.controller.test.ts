/**
 * Ambientes, sistemas, categorias/fabricantes (options), campos e modelos da
 * proposta passam pelo controller auxiliar. Até 2026-10:
 *
 * - a exclusão não conferia permissão nenhuma: qualquer membro da empresa,
 *   até o técnico de campo, apagava um ambiente ou uma categoria pela API;
 * - a edição exigia também "Excluir";
 * - options (categoria e fabricante de Produtos e Serviços) conferiam a
 *   permissão de Propostas, que não as usa.
 *
 * A permissão é a de verdade (`hasPagePermission`), lida de um Firestore falso.
 */

import type { Request, Response } from "express";

let permissionDocs: Record<string, Record<string, Record<string, unknown>>>;
let docs: Record<string, Record<string, Record<string, unknown>>>;
const deleted: string[] = [];
const updated: string[] = [];
const added: string[] = [];

jest.mock("../../init", () => ({
  auth: {},
  db: {
    collection: (name: string) => {
      if (name === "users") {
        return {
          doc: (uid: string) => ({
            get: async () => ({
              exists: true,
              data: () =>
                uid.startsWith("master")
                  ? { tenantId: "t1", role: "MASTER" }
                  : { tenantId: "t1", role: "MEMBER", masterId: "master-1" },
            }),
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
      return {
        add: async () => {
          added.push(name);
          return { id: "novo" };
        },
        doc: (id: string) => ({
          get: async () => ({ exists: !!docs[name]?.[id], data: () => docs[name]?.[id] }),
          update: async () => {
            updated.push(`${name}/${id}`);
          },
          delete: async () => {
            deleted.push(`${name}/${id}`);
          },
        }),
      };
    },
  },
}));

import {
  createOption,
  deleteAmbiente,
  deleteOption,
  deleteProposalTemplate,
  deleteSistema,
  updateAmbiente,
  updateOption,
} from "./auxiliary.controller";

function req(uid: string, params: Record<string, string> = {}, body: Record<string, unknown> = {}) {
  return {
    user: {
      uid,
      tenantId: "t1",
      role: uid.startsWith("master") ? "MASTER" : "MEMBER",
      masterId: uid.startsWith("master") ? undefined : "master-1",
    },
    params,
    body,
  } as unknown as Request;
}

function makeRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { res: { status, json } as unknown as Response, status, json };
}

const TECHNICIAN = {
  service_orders: { canView: true, canEdit: true },
  equipment: { canView: true },
  calendar: { canView: true },
};

beforeEach(() => {
  deleted.length = 0;
  updated.length = 0;
  added.length = 0;
  permissionDocs = {
    tec: TECHNICIAN,
    solucoes: { solutions: { canView: true, canEdit: true, canDelete: true } },
    solucoesEdita: { solutions: { canView: true, canEdit: true, canDelete: false } },
    produtos: { products: { canView: true, canCreate: true, canEdit: true, canDelete: true } },
    servicos: { services: { canView: true, canCreate: true } },
    propostas: { proposals: { canView: true, canCreate: true, canEdit: true, canDelete: true } },
  };
  docs = {
    ambientes: { a1: { tenantId: "t1", name: "Sala" } },
    sistemas: { s1: { tenantId: "t1", name: "Áudio" } },
    options: { o1: { tenantId: "t1", type: "product_categories", label: "Sensores" } },
    proposalTemplates: { m1: { tenantId: "t1", name: "Modelo" } },
  };
});

describe("exclusão confere a permissão do módulo", () => {
  it("técnico não apaga ambiente, sistema nem categoria", async () => {
    for (const [handler, id] of [
      [deleteAmbiente, "a1"],
      [deleteSistema, "s1"],
      [deleteOption, "o1"],
    ] as const) {
      const { res, status } = makeRes();
      await handler(req("tec", { id }), res);
      expect(status).toHaveBeenCalledWith(403);
    }
    expect(deleted).toEqual([]);
  });

  it("quem pode excluir em Soluções apaga o ambiente", async () => {
    const { res } = makeRes();
    await deleteAmbiente(req("solucoes", { id: "a1" }), res);
    expect(deleted).toEqual(["ambientes/a1"]);
  });

  it("quem só edita Soluções não apaga", async () => {
    const { res, status } = makeRes();
    await deleteAmbiente(req("solucoesEdita", { id: "a1" }), res);
    expect(status).toHaveBeenCalledWith(403);
    expect(deleted).toEqual([]);
  });

  it("modelo de proposta segue a permissão de Propostas", async () => {
    const tec = makeRes();
    await deleteProposalTemplate(req("tec", { id: "m1" }), tec.res);
    expect(tec.status).toHaveBeenCalledWith(403);

    const prop = makeRes();
    await deleteProposalTemplate(req("propostas", { id: "m1" }), prop.res);
    expect(deleted).toEqual(["proposalTemplates/m1"]);
  });

  it("dono apaga sem doc de permissão", async () => {
    const { res } = makeRes();
    await deleteSistema(req("master-1", { id: "s1" }), res);
    expect(deleted).toEqual(["sistemas/s1"]);
  });
});

describe("edição não exige mais 'Excluir'", () => {
  it("quem edita e não exclui em Soluções edita o ambiente", async () => {
    const { res, json } = makeRes();
    await updateAmbiente(req("solucoesEdita", { id: "a1" }, { name: "Sala de estar" }), res);
    expect(updated).toEqual(["ambientes/a1"]);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe("options seguem os cadastros, não Propostas", () => {
  it("quem edita Produtos cria, renomeia e apaga categoria", async () => {
    await createOption(req("produtos", {}, { label: "Sensores", type: "product_categories" }), makeRes().res);
    await updateOption(req("produtos", { id: "o1" }, { label: "Sensor" }), makeRes().res);
    await deleteOption(req("produtos", { id: "o1" }), makeRes().res);
    expect(added).toEqual(["options"]);
    expect(updated).toEqual(["options/o1"]);
    expect(deleted).toEqual(["options/o1"]);
  });

  it("quem cria Serviços cria a categoria do serviço", async () => {
    await createOption(req("servicos", {}, { label: "Instalação", type: "product_categories" }), makeRes().res);
    expect(added).toEqual(["options"]);
  });

  it("quem só tem Propostas não mexe nas categorias", async () => {
    const { res, status } = makeRes();
    await createOption(req("propostas", {}, { label: "X", type: "product_categories" }), res);
    expect(status).toHaveBeenCalledWith(403);
    expect(added).toEqual([]);
  });
});
