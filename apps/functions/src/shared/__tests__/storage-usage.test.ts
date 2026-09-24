import {
  bytesToMb,
  isOverStorageQuota,
  tenantForCountedPath,
} from "../storage-usage";

describe("tenantForCountedPath", () => {
  it.each([
    "tenants/t1/products/p1/foto.png",
    "tenants/t1/products/foto.png",
    "tenants/t1/services/s1/foto.png",
    "tenants/t1/proposals/pr1/capa.png",
    "tenants/t1/proposals/pr1/attachments/memorial.pdf",
  ])("conta o que a empresa sobe: %s", (path) => {
    expect(tenantForCountedPath(path)).toBe("t1");
  });

  it.each([
    // Gerado pelo sistema: cache do PDF e recibo.
    "tenants/t1/proposals/pr1/pdf/proposal.pdf",
    "tenants/t1/transactions/tx1/pdf/receipt.pdf",
    // Guarda legal de 5 anos: nao pode competir com o teto do plano.
    "tenants/t1/fiscal/n1/nota.xml",
    // Fora do prefixo de empresa.
    "public/logo.png",
    "tenants//products/p1/foto.png",
    "tenants/t1",
  ])("nao conta: %s", (path) => {
    expect(tenantForCountedPath(path)).toBeNull();
  });
});

describe("isOverStorageQuota", () => {
  it("estoura no teto, nao so acima dele", () => {
    const mb = 1024 * 1024;
    expect(isOverStorageQuota(199 * mb, 200)).toBe(false);
    expect(isOverStorageQuota(200 * mb, 200)).toBe(true);
  });

  it("ilimitado nunca estoura", () => {
    expect(isOverStorageQuota(10_000 * 1024 * 1024, -1)).toBe(false);
  });

  it("bytesToMb nunca devolve negativo", () => {
    expect(bytesToMb(-5)).toBe(0);
  });
});
