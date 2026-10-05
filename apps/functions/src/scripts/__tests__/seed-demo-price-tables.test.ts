/**
 * Cada demonstração de nicho traz uma tabela de preço e um cliente apontando
 * para ela: a conta free navega a aba "Tabelas de preço" de Produtos e vê o
 * seletor preenchido no cadastro desse cliente.
 */

import { DEMO_DATASETS } from "../demo/datasets";
import { buildDemoDocs } from "../demo/engine";
import { TENANT_NICHES } from "../../shared/niches";

const build = (niche: keyof typeof DEMO_DATASETS) =>
  buildDemoDocs(DEMO_DATASETS[niche], {
    now: new Date("2026-07-15T14:00:00.000Z"),
    timestamp: (ms) => ({ __ts: ms }),
  });

describe.each(TENANT_NICHES)("demonstração %s", (niche) => {
  const dataset = DEMO_DATASETS[niche];
  const sets = build(niche).flatMap((w) => (w.op === "set" ? [w] : []));
  const tables = sets.filter((w) => w.path.startsWith("price_tables/"));
  const clients = sets.filter((w) => w.path.startsWith("clients/"));

  it("grava ao menos uma tabela no tenant de demonstração do nicho", () => {
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.data).toMatchObject({ tenantId: dataset.tenantId });
      expect(typeof (table.data as { adjustmentPercent: unknown }).adjustmentPercent).toBe("number");
    }
  });

  it("um cliente aponta para uma tabela que existe", () => {
    const ids = new Set(tables.map((t) => t.path.split("/")[1]));
    const withTable = clients.filter((c) => (c.data as { priceTableId?: string }).priceTableId);
    expect(withTable.length).toBeGreaterThan(0);
    for (const client of withTable) {
      expect(ids.has((client.data as { priceTableId: string }).priceTableId)).toBe(true);
    }
  });

  it("preço próprio só em produto do dataset que não é por faixa de altura", () => {
    const byId = new Map(dataset.products.map((p) => [p.id, p]));
    for (const table of dataset.priceTables) {
      for (const productId of Object.keys(table.productPrices)) {
        expect(byId.has(productId)).toBe(true);
        expect(byId.get(productId)!.pricingModel?.mode).not.toBe("curtain_height");
      }
    }
  });
});

it("o motor recusa cliente apontando para tabela que não existe", () => {
  const dataset = DEMO_DATASETS.automacao_residencial;
  const broken = {
    ...dataset,
    clients: [{ ...dataset.clients[0], priceTableId: "nao-existe" }],
  };
  expect(() =>
    buildDemoDocs(broken, { now: new Date(), timestamp: (ms) => ({ __ts: ms }) }),
  ).toThrow(/tabela de preço/);
});
