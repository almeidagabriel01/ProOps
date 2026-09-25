/**
 * Criar, editar ou excluir um produto apagava o cache inteiro do catálogo, e a
 * próxima tela baixava todos os produtos do tenant de novo. Agora só o produto
 * afetado é relido (ou removido) e o resto do cache continua valendo.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDocsMock = vi.fn();
const getDocMock = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  doc: vi.fn((_db: unknown, _c: string, id: string) => ({ id })),
  documentId: vi.fn(),
  getDocs: (...a: unknown[]) => getDocsMock(...a),
  getDoc: (...a: unknown[]) => getDocMock(...a),
  getCountFromServer: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
}));
vi.mock("@/lib/firebase", () => ({ db: {} }));
vi.mock("@/lib/api-client", () => ({ callApi: vi.fn() }));

import { ProductService } from "../product-service";

const docOf = (id: string, name: string, tenantId = "t1") => ({
  id,
  exists: () => true,
  data: () => ({ tenantId, name, inventoryValue: 1 }),
});

let tenantSeq = 0;
let T = "t1";

beforeEach(() => {
  getDocsMock.mockReset();
  getDocMock.mockReset();
  // Tenant novo por teste: o cache do service é módulo-global.
  T = `t${++tenantSeq}`;
});

async function loadCatalog() {
  getDocsMock.mockResolvedValueOnce({
    docs: [docOf("p1", "Um", T), docOf("p2", "Dois", T)],
  });
  await ProductService.getProducts(T);
  expect(getDocsMock).toHaveBeenCalledTimes(1);
}

describe("cache do catálogo após mutação", () => {
  it("edição relê só o produto e o catálogo segue em cache", async () => {
    await loadCatalog();
    getDocMock.mockResolvedValueOnce(docOf("p1", "Um editado", T));
    await ProductService.refreshCachedProduct(T, "p1");
    const products = await ProductService.getProducts(T);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(getDocMock).toHaveBeenCalledTimes(1);
    expect(products.find((p) => p.id === "p1")?.name).toBe("Um editado");
    expect(products).toHaveLength(2);
  });

  it("criação entra no catálogo em cache", async () => {
    await loadCatalog();
    getDocMock.mockResolvedValueOnce(docOf("p3", "Três", T));
    await ProductService.refreshCachedProduct(T, "p3");
    const products = await ProductService.getProducts(T);
    expect(products.map((p) => p.id).sort()).toEqual(["p1", "p2", "p3"]);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it("exclusão remove só aquele item", async () => {
    await loadCatalog();
    ProductService.removeCachedProduct(T, "p2");
    const products = await ProductService.getProducts(T);
    expect(products.map((p) => p.id)).toEqual(["p1"]);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it("sem cache ativo não lê nada", async () => {
    await ProductService.refreshCachedProduct(T, "p1");
    expect(getDocMock).not.toHaveBeenCalled();
  });

  it("falha na releitura invalida e o próximo acesso baixa de novo", async () => {
    await loadCatalog();
    getDocMock.mockRejectedValueOnce(new Error("offline"));
    await ProductService.refreshCachedProduct(T, "p1");
    getDocsMock.mockResolvedValueOnce({ docs: [docOf("p1", "Um", T)] });
    await ProductService.getProducts(T);
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it("documento de outro tenant não entra no cache", async () => {
    await loadCatalog();
    getDocMock.mockResolvedValueOnce(docOf("p1", "Intruso", "outro"));
    await ProductService.refreshCachedProduct(T, "p1");
    const products = await ProductService.getProducts(T);
    expect(products.map((p) => p.id)).toEqual(["p2"]);
  });
});
