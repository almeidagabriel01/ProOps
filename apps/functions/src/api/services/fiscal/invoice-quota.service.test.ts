/**
 * Franquia mensal do add-on fiscal: 100 notas. O preco do add-on foi calculado
 * sobre ela (cada nota consome uma unidade paga no Focus), entao passar do
 * teto em silencio e prejuizo por construcao.
 */

const countGet = jest.fn();
const where = jest.fn();
const resolveTenantCapabilities = jest.fn();

jest.mock("../../../init", () => {
  const chain = {
    where: (...args: unknown[]) => {
      where(...args);
      return chain;
    },
    orderBy: () => chain,
    count: () => ({ get: countGet }),
  };
  return { db: { collection: () => chain } };
});
jest.mock("../../../lib/tenant-capabilities", () => ({
  resolveTenantCapabilities: (id: string) => resolveTenantCapabilities(id),
}));

import {
  InvoiceQuotaError,
  QUOTA_CONSUMING_STATUSES,
  assertInvoiceQuota,
  brasiliaMonthStartIso,
  getInvoiceQuota,
} from "./invoice-quota.service";

function withLimit(limit: number, used: number) {
  resolveTenantCapabilities.mockResolvedValue({ limits: { maxInvoicesPerMonth: limit } });
  countGet.mockResolvedValue({ data: () => ({ count: used }) });
}

beforeEach(() => jest.clearAllMocks());

describe("brasiliaMonthStartIso", () => {
  it("vira o mes pelo relogio de Brasilia, nao pelo UTC", () => {
    // 30/09 23h em Brasilia = 01/10 02h UTC: ainda e setembro.
    expect(brasiliaMonthStartIso(new Date("2026-10-01T02:00:00Z"))).toBe(
      "2026-09-01T03:00:00.000Z",
    );
    // 01/10 00h30 em Brasilia: ja e outubro.
    expect(brasiliaMonthStartIso(new Date("2026-10-01T03:30:00Z"))).toBe(
      "2026-10-01T03:00:00.000Z",
    );
  });

  it("atravessa o ano", () => {
    expect(brasiliaMonthStartIso(new Date("2027-01-01T02:59:00Z"))).toBe(
      "2026-12-01T03:00:00.000Z",
    );
  });
});

describe("assertInvoiceQuota", () => {
  it("deixa emitir a 100a nota", async () => {
    withLimit(100, 99);
    await expect(assertInvoiceQuota("t1", 1)).resolves.toBeUndefined();
  });

  it("barra a 101a nota com usados e limite", async () => {
    withLimit(100, 100);
    const err = await assertInvoiceQuota("t1", 1).catch((e) => e);
    expect(err).toBeInstanceOf(InvoiceQuotaError);
    expect(err.message).toBe("FISCAL_COTA_MENSAL_ATINGIDA");
    expect(err).toMatchObject({ used: 100, limit: 100 });
  });

  it("venda mista com uma vaga barra as duas notas", async () => {
    withLimit(100, 99);
    await expect(assertInvoiceQuota("t1", 2)).rejects.toBeInstanceOf(InvoiceQuotaError);
  });

  it("plano sem o modulo (limite 0) nao emite nada", async () => {
    withLimit(0, 0);
    await expect(assertInvoiceQuota("t1", 1)).rejects.toBeInstanceOf(InvoiceQuotaError);
  });

  it("Enterprise ilimitado nem conta as notas", async () => {
    withLimit(-1, 5000);
    await expect(assertInvoiceQuota("t1", 2)).resolves.toBeUndefined();
    expect(countGet).not.toHaveBeenCalled();
  });
});

describe("getInvoiceQuota", () => {
  it("conta so o que chegou ao provedor, do tenant, a partir do inicio do mes", async () => {
    withLimit(100, 7);
    await expect(getInvoiceQuota("t1")).resolves.toEqual({ limit: 100, used: 7 });
    expect(where).toHaveBeenCalledWith("tenantId", "==", "t1");
    expect(where).toHaveBeenCalledWith("status", "in", QUOTA_CONSUMING_STATUSES);
    expect(QUOTA_CONSUMING_STATUSES).not.toContain("rejected");
    expect(QUOTA_CONSUMING_STATUSES).not.toContain("draft");
  });
});
