/**
 * Imagens por produto: Starter 2, Pro e Enterprise 3. Ate 2026-09 so a tela
 * barrava; o schema aceitava 20 de qualquer plano.
 */

const resolveTenantCapabilities = jest.fn();
jest.mock("../tenant-capabilities", () => ({
  resolveTenantCapabilities: (id: string) => resolveTenantCapabilities(id),
}));

import { checkImagesWithinPlan } from "../catalog-plan-guards";

function plano(maxImagesPerProduct: number) {
  resolveTenantCapabilities.mockResolvedValue({ limits: { maxImagesPerProduct } });
}

beforeEach(() => jest.clearAllMocks());

it("Starter cria com 2 imagens e e barrado com 3", async () => {
  plano(2);
  await expect(checkImagesWithinPlan({ tenantId: "t", requested: 2 })).resolves.toEqual({
    allowed: true,
  });
  const barrado = await checkImagesWithinPlan({ tenantId: "t", requested: 3 });
  expect(barrado).toMatchObject({ allowed: false, limit: 2 });
});

it("depois de um downgrade, editar um item com 3 fotos continua possivel", async () => {
  plano(2);
  await expect(
    checkImagesWithinPlan({ tenantId: "t", requested: 3, existing: 3 }),
  ).resolves.toEqual({ allowed: true });
  // ...mas nao se acrescenta uma quarta.
  await expect(
    checkImagesWithinPlan({ tenantId: "t", requested: 4, existing: 3 }),
  ).resolves.toMatchObject({ allowed: false });
});

it("Pro aceita 3", async () => {
  plano(3);
  await expect(checkImagesWithinPlan({ tenantId: "t", requested: 3 })).resolves.toEqual({
    allowed: true,
  });
});

it("super admin nao e barrado nem consulta o plano", async () => {
  await expect(
    checkImagesWithinPlan({ tenantId: "t", requested: 20, isSuperAdmin: true }),
  ).resolves.toEqual({ allowed: true });
  expect(resolveTenantCapabilities).not.toHaveBeenCalled();
});
