/**
 * Responsáveis técnicos do PMOC: só o dono e os administradores cadastram, a
 * ART só entra como PDF de verdade e dentro da cota, e quem assina um contrato
 * PMOC em vigor não se exclui.
 */

import type { Request, Response } from "express";

type Doc = Record<string, unknown>;
let store: Record<string, Record<string, Doc>>;
let autoId = 0;
const stored: string[] = [];
const deleted: string[] = [];
let overQuota = false;

jest.mock("../services/projects/project.service", () => ({
  isStorageOverQuota: async () => overQuota,
}));
jest.mock("../services/field-service/field-service.service", () => ({
  loadOfTenant: async (collection: string, id: string, tenantId: string) => {
    const data = store[collection]?.[id];
    if (!data || data.tenantId !== tenantId) return null;
    const ref = {
      id,
      update: async (patch: Doc) => {
        store[collection][id] = { ...store[collection][id], ...patch };
      },
      delete: async () => {
        delete store[collection][id];
      },
    };
    return { ref, data };
  },
  storeOrderFile: async (p: { path: string }) => {
    stored.push(p.path);
    return `https://files.test/${p.path}`;
  },
  deleteOrderFiles: async (paths: string[]) => {
    deleted.push(...paths);
  },
}));
jest.mock("../../init", () => {
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (field: string, _op: string, value: unknown) => query(name, [...filters, [field, value]]),
    limit: () => query(name, filters),
    get: async () => {
      const docs = Object.entries(store[name] ?? {})
        .filter(([, d]) =>
          filters.every(([f, v]) => {
            const value = f.split(".").reduce<unknown>((acc, k) => (acc as Doc | undefined)?.[k], d);
            return value === v;
          }),
        )
        .map(([id, d]) => ({ id, data: () => d }));
      return { docs };
    },
  });
  return {
    db: {
      collection: (name: string) => ({
        doc: (id?: string) => {
          const docId = id ?? `rt_${++autoId}`;
          return {
            id: docId,
            set: async (data: Doc) => {
              store[name] = store[name] ?? {};
              store[name][docId] = data;
            },
          };
        },
        where: (field: string, op: string, value: unknown) => query(name, []).where(field, op, value),
      }),
    },
  };
});

import {
  createTechnicalResponsible,
  deleteTechnicalResponsible,
  removeTechnicalResponsibleArt,
  updateTechnicalResponsible,
  uploadTechnicalResponsibleArt,
} from "./technical-responsibles.controller";
import { artStatus, decodeArtPdf } from "../services/field-service/technical-responsible-model";

type MockRes = Response & { statusCode: number; body: Doc };

function mockRes(): MockRes {
  const state = { statusCode: 200, body: {} as Doc };
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
    json(body: Doc) {
      state.body = body;
      return res;
    },
  };
  return res as unknown as MockRes;
}

function req(role: string, body: unknown = {}, params: Doc = {}, tenantId = "t1"): Request {
  return { user: { uid: "u1", tenantId, role }, body, params } as unknown as Request;
}

const VALID = {
  name: "Carla Mendes",
  profession: "Engenheira mecânica",
  council: "CREA",
  registryNumber: "SP-123456",
  artNumber: "ART-2026-0001",
  artValidUntil: "2027-03-31",
};

const pdfDataUrl = (body = "%PDF-1.4 conteudo") =>
  `data:application/pdf;base64,${Buffer.from(body).toString("base64")}`;

beforeEach(() => {
  store = { technical_responsibles: {}, service_contracts: {} };
  stored.length = 0;
  deleted.length = 0;
  overQuota = false;
});

describe("cadastro", () => {
  it.each(["MASTER", "ADMIN"])("%s cadastra", async (role) => {
    const res = mockRes();
    await createTechnicalResponsible(req(role, VALID), res);
    expect(res.statusCode).toBe(201);
    const saved = store.technical_responsibles[res.body.id as string];
    expect(saved).toMatchObject({ tenantId: "t1", council: "CREA", active: true, artFile: null });
  });

  it.each(["MEMBER", "FREE"])("%s não cadastra", async (role) => {
    const res = mockRes();
    await createTechnicalResponsible(req(role, VALID), res);
    expect(res.statusCode).toBe(403);
    expect(store.technical_responsibles).toEqual({});
  });

  it("recusa conselho desconhecido e campo a mais", async () => {
    const a = mockRes();
    await createTechnicalResponsible(req("MASTER", { ...VALID, council: "OAB" }), a);
    expect(a.statusCode).toBe(400);
    const b = mockRes();
    await createTechnicalResponsible(req("MASTER", { ...VALID, tenantId: "outro" }), b);
    expect(b.statusCode).toBe(400);
  });

  it("não alcança o responsável de outra empresa", async () => {
    store.technical_responsibles.rt9 = { tenantId: "t2", name: "Outro" };
    const res = mockRes();
    await updateTechnicalResponsible(req("MASTER", { name: "Trocado" }, { id: "rt9" }), res);
    expect(res.statusCode).toBe(404);
    expect(store.technical_responsibles.rt9.name).toBe("Outro");
  });

  it("atualiza só o que veio", async () => {
    store.technical_responsibles.rt1 = { tenantId: "t1", ...VALID, active: true };
    const res = mockRes();
    await updateTechnicalResponsible(req("ADMIN", { artValidUntil: "2028-01-31" }, { id: "rt1" }), res);
    expect(res.statusCode).toBe(200);
    expect(store.technical_responsibles.rt1).toMatchObject({ name: VALID.name, artValidUntil: "2028-01-31" });
  });
});

describe("exclusão", () => {
  it("contrato PMOC em vigor impede; encerrado não", async () => {
    store.technical_responsibles.rt1 = { tenantId: "t1", ...VALID, artFile: { path: "a/art.pdf" } };
    store.service_contracts.c1 = { tenantId: "t1", status: "active", pmoc: { responsibleId: "rt1" } };
    const blocked = mockRes();
    await deleteTechnicalResponsible(req("MASTER", {}, { id: "rt1" }), blocked);
    expect(blocked.statusCode).toBe(409);
    expect(store.technical_responsibles.rt1).toBeDefined();

    store.service_contracts.c1.status = "ended";
    const ok = mockRes();
    await deleteTechnicalResponsible(req("MASTER", {}, { id: "rt1" }), ok);
    expect(ok.statusCode).toBe(200);
    expect(store.technical_responsibles.rt1).toBeUndefined();
    expect(deleted).toEqual(["a/art.pdf"]);
  });

  it("contrato de outra empresa com o mesmo id não conta", async () => {
    store.technical_responsibles.rt1 = { tenantId: "t1", ...VALID };
    store.service_contracts.c9 = { tenantId: "t2", status: "active", pmoc: { responsibleId: "rt1" } };
    const res = mockRes();
    await deleteTechnicalResponsible(req("MASTER", {}, { id: "rt1" }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe("ART em PDF", () => {
  beforeEach(() => {
    store.technical_responsibles.rt1 = { tenantId: "t1", ...VALID, artFile: null };
  });

  it("guarda no caminho da empresa e grava o arquivo no cadastro", async () => {
    const res = mockRes();
    await uploadTechnicalResponsibleArt(
      req("MASTER", { dataUrl: pdfDataUrl(), fileName: "art.pdf" }, { id: "rt1" }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(stored).toEqual(["tenants/t1/technical_responsibles/rt1/art.pdf"]);
    expect(store.technical_responsibles.rt1.artFile).toMatchObject({ name: "art.pdf", path: stored[0] });
  });

  it("recusa arquivo que não é PDF, mesmo declarado como PDF", async () => {
    const res = mockRes();
    await uploadTechnicalResponsibleArt(
      req("MASTER", { dataUrl: pdfDataUrl("<html>nao sou pdf"), fileName: "art.pdf" }, { id: "rt1" }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(stored).toEqual([]);
  });

  it("armazenamento cheio leva 402 sem gravar", async () => {
    overQuota = true;
    const res = mockRes();
    await uploadTechnicalResponsibleArt(
      req("MASTER", { dataUrl: pdfDataUrl(), fileName: "art.pdf" }, { id: "rt1" }),
      res,
    );
    expect(res.statusCode).toBe(402);
    expect(stored).toEqual([]);
  });

  it("membro não envia nem remove", async () => {
    const up = mockRes();
    await uploadTechnicalResponsibleArt(
      req("MEMBER", { dataUrl: pdfDataUrl(), fileName: "art.pdf" }, { id: "rt1" }),
      up,
    );
    expect(up.statusCode).toBe(403);
    const rm = mockRes();
    await removeTechnicalResponsibleArt(req("MEMBER", {}, { id: "rt1" }), rm);
    expect(rm.statusCode).toBe(403);
  });

  it("remover apaga o arquivo e limpa o cadastro", async () => {
    store.technical_responsibles.rt1.artFile = { path: "tenants/t1/technical_responsibles/rt1/art.pdf" };
    const res = mockRes();
    await removeTechnicalResponsibleArt(req("ADMIN", {}, { id: "rt1" }), res);
    expect(res.statusCode).toBe(200);
    expect(deleted).toEqual(["tenants/t1/technical_responsibles/rt1/art.pdf"]);
    expect(store.technical_responsibles.rt1.artFile).toBeNull();
  });
});

describe("modelo", () => {
  it("decodeArtPdf recusa tipo errado, vazio e acima do teto", () => {
    expect(decodeArtPdf("data:image/png;base64,AAAA")).toBeNull();
    expect(decodeArtPdf("data:application/pdf;base64,")).toBeNull();
    expect(decodeArtPdf(pdfDataUrl("%PDF-" + "x".repeat(700 * 1024)))).toBeNull();
    expect(decodeArtPdf(pdfDataUrl())).not.toBeNull();
  });

  it("artStatus: sem data, vencida, vencendo em 30 dias e válida", () => {
    expect(artStatus(null, "2026-09-29")).toBe("missing");
    expect(artStatus("2026-09-28", "2026-09-29")).toBe("expired");
    expect(artStatus("2026-09-29", "2026-09-29")).toBe("expiring");
    expect(artStatus("2026-10-29", "2026-09-29")).toBe("expiring");
    expect(artStatus("2026-10-30", "2026-09-29")).toBe("valid");
  });
});
