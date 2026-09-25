/**
 * Imagens por item do catálogo: regra de NICHO, igual em todos os planos
 * (automação 1, cortinas 3 em produto, serviço 1). Antes o backend aplicava o
 * teto do plano (Starter 2, Pro/Enterprise 3) enquanto a tela aplicava o do
 * nicho, e um Starter de cortinas levava 402 na 3ª foto que a tela aceitava.
 */

let tenantData: Record<string, unknown> | undefined;
const getTenantDocCached = jest.fn();
jest.mock("../tenant-doc-cache", () => ({
  getTenantDocCached: (id: string) => getTenantDocCached(id),
}));
jest.mock("../tenant-capabilities", () => ({
  resolveTenantCapabilities: jest.fn(),
}));

import { checkCatalogImagesLimit } from "../catalog-plan-guards";

beforeEach(() => {
  jest.clearAllMocks();
  getTenantDocCached.mockImplementation(async () => ({
    exists: tenantData !== undefined,
    data: tenantData,
  }));
});

function nicho(niche: string | undefined) {
  tenantData = niche === undefined ? {} : { niche };
}

it("automação residencial: produto aceita 1 imagem e barra a 2ª", async () => {
  nicho("automacao_residencial");
  await expect(
    checkCatalogImagesLimit({ tenantId: "t", itemType: "product", requested: 1 }),
  ).resolves.toEqual({ allowed: true });
  await expect(
    checkCatalogImagesLimit({ tenantId: "t", itemType: "product", requested: 2 }),
  ).resolves.toMatchObject({ allowed: false, limit: 1 });
});

it("cortinas: produto aceita 3, em qualquer plano, e barra a 4ª", async () => {
  nicho("cortinas");
  await expect(
    checkCatalogImagesLimit({ tenantId: "t", itemType: "product", requested: 3 }),
  ).resolves.toEqual({ allowed: true });
  await expect(
    checkCatalogImagesLimit({ tenantId: "t", itemType: "product", requested: 4 }),
  ).resolves.toMatchObject({ allowed: false, limit: 3 });
});

it("serviço aceita 1 imagem nos dois nichos", async () => {
  for (const n of ["cortinas", "automacao_residencial"]) {
    nicho(n);
    await expect(
      checkCatalogImagesLimit({ tenantId: "t", itemType: "service", requested: 2 }),
    ).resolves.toMatchObject({ allowed: false, limit: 1 });
  }
});

it("tenant sem nicho gravado cai no padrão de 1", async () => {
  nicho(undefined);
  await expect(
    checkCatalogImagesLimit({ tenantId: "t", itemType: "product", requested: 2 }),
  ).resolves.toMatchObject({ allowed: false, limit: 1 });
});

it("item cadastrado antes da regra com mais fotos continua editável, sem passar do que tinha", async () => {
  nicho("automacao_residencial");
  await expect(
    checkCatalogImagesLimit({ tenantId: "t", itemType: "product", requested: 3, existing: 3 }),
  ).resolves.toEqual({ allowed: true });
  await expect(
    checkCatalogImagesLimit({ tenantId: "t", itemType: "product", requested: 4, existing: 3 }),
  ).resolves.toMatchObject({ allowed: false });
});

it("super admin não é barrado nem lê o tenant", async () => {
  await expect(
    checkCatalogImagesLimit({ tenantId: "t", itemType: "product", requested: 20, isSuperAdmin: true }),
  ).resolves.toEqual({ allowed: true });
  expect(getTenantDocCached).not.toHaveBeenCalled();
});
