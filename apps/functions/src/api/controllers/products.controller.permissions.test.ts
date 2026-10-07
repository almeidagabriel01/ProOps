/**
 * Custo, markup e estoque são dados sensíveis do catálogo de permissões. A
 * vendedora que o dono deixou editar a descrição do produto não muda preço nem
 * estoque (os campos são descartados da edição), e sem "Ver custo" ela não
 * cadastra produto, que nasce do custo.
 */

import type { Request, Response } from "express";

let mockGrants: Record<string, boolean> = {};
let mockIsMaster = false;
const updates: Array<Record<string, unknown>> = [];

jest.mock("../../init", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ tenantId: "t1", name: "Câmera", price: "1167", markup: "50" }) }),
        update: async (data: Record<string, unknown>) => {
          updates.push(data);
        },
      }),
    }),
  },
}));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { delete: () => ({ __delete: true }), increment: (n: number) => ({ __inc: n }) },
  Timestamp: { now: () => "agora" },
}));
jest.mock("../../lib/auth-helpers", () => ({
  resolveUserAndTenant: async () => ({
    tenantId: "t1",
    isMaster: mockIsMaster,
    isSuperAdmin: false,
    masterRef: {},
    masterData: {},
    userData: {},
  }),
  checkPermission: async (_uid: string, _page: string, key: string) => mockGrants[key] === true,
}));
jest.mock("../../lib/storage-helpers", () => ({ deleteProductImages: jest.fn() }));
jest.mock("../../lib/tenant-plan-policy", () => ({
  enforceTenantPlanLimit: async () => ({ allowed: true }),
  getTenantProductsUsage: async () => 0,
}));
jest.mock("../../lib/catalog-plan-guards", () => ({ checkCatalogImagesLimit: async () => ({ allowed: true }) }));

import { createProduct, updateProduct } from "./products.controller";

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

function req(body: Record<string, unknown>, params: Record<string, string> = {}) {
  return { body, params, user: { uid: "m1", tenantId: "t1", role: "MEMBER" } } as unknown as Request;
}

beforeEach(() => {
  updates.length = 0;
  mockIsMaster = false;
  mockGrants = { canView: true, canCreate: true, canEdit: true, viewCost: true, editPrice: true, viewStock: true, adjustStock: true };
});

describe("editar produto", () => {
  const body = { name: "Câmera 4K", price: "1", markup: "0", inventoryValue: 99 };

  it("com tudo liberado, grava preço e estoque", async () => {
    await updateProduct(req(body, { id: "p1" }), fakeRes());
    expect(updates[0]).toMatchObject({ name: "Câmera 4K", price: "1", markup: "0", inventoryValue: 99 });
  });

  it("sem ver o custo, o preço não muda; o resto sim", async () => {
    mockGrants.viewCost = false;
    const res = fakeRes();
    await updateProduct(req(body, { id: "p1" }), res);
    expect(res.statusCode).toBe(200);
    expect(updates[0]).toMatchObject({ name: "Câmera 4K", inventoryValue: 99 });
    expect(updates[0]).not.toHaveProperty("price");
    expect(updates[0]).not.toHaveProperty("markup");
  });

  it("vê o custo mas sem 'Mudar preço', o preço não muda", async () => {
    mockGrants.editPrice = false;
    await updateProduct(req({ ...body, pricingModel: { mode: "standard" } }, { id: "p1" }), fakeRes());
    expect(updates[0]).not.toHaveProperty("price");
    expect(updates[0]).not.toHaveProperty("pricingModel");
  });

  it("sem ver ou sem ajustar o estoque, o estoque não muda", async () => {
    mockGrants.adjustStock = false;
    await updateProduct(req(body, { id: "p1" }), fakeRes());
    mockGrants.adjustStock = true;
    mockGrants.viewStock = false;
    await updateProduct(req(body, { id: "p1" }), fakeRes());
    for (const update of updates) {
      expect(update).not.toHaveProperty("inventoryValue");
      expect(update).not.toHaveProperty("stock");
    }
  });

  it("o dono grava tudo sem doc de permissão", async () => {
    mockIsMaster = true;
    mockGrants = {};
    await updateProduct(req(body, { id: "p1" }), fakeRes());
    expect(updates[0]).toMatchObject({ price: "1", inventoryValue: 99 });
  });
});

describe("cadastrar produto", () => {
  it("sem ver o custo, 403", async () => {
    mockGrants.viewCost = false;
    const res = fakeRes();
    await createProduct(req({ name: "Fonte", price: "98", markup: "44" }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("PRODUCT_COST_PERMISSION_REQUIRED");
  });
});
