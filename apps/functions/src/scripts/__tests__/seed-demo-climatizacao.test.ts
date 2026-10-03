/**
 * A demonstração de climatização e ar-condicionado: tudo no tenant
 * `demo-climatizacao`, com IDs próprios, aparelho e suporte por unidade,
 * tubulação e cabo pelo comprimento, e propostas por ambiente com o total
 * igual à soma das linhas.
 */

const set = jest.fn();
const commit = jest.fn().mockResolvedValue(undefined);
const collection = jest.fn((name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    batch: () => ({ set, delete: jest.fn(), commit }),
    collection: (name: string) => collection(name),
  }),
  Timestamp: { fromMillis: (ms: number) => ({ __ts: ms }) },
}));
jest.mock("../../lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

import { DEMO_TENANT_IDS } from "../../shared/demo-tenant";
import { seedDemo } from "../demo/seed";
import { DEMO_DATASETS } from "../demo/datasets";
import { itemExecutions } from "../../api/services/field-service/pmoc-report";
import type { PmocItem } from "../../shared/pmoc";

const TENANT_ID = DEMO_TENANT_IDS.climatizacao;
const seed = () => seedDemo(DEMO_DATASETS.climatizacao);

type Written = { path: string; data: Record<string, unknown> };
const written = (): Written[] =>
  set.mock.calls.map(([ref, data]) => ({ path: (ref as { path: string }).path, data }));

beforeEach(() => {
  set.mockClear();
  commit.mockClear();
});

describe("demonstração de climatização e ar-condicionado", () => {
  it("é o tenant de demonstração do nicho", async () => {
    expect(TENANT_ID).toBe("demo-climatizacao");
    await seed();
    const tenant = written().find((w) => w.path === `tenants/${TENANT_ID}`);
    expect(tenant?.data).toMatchObject({ niche: "climatizacao", isDemo: true });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("todo documento é do tenant de demonstração e tem id próprio", async () => {
    await seed();
    for (const w of written()) {
      if (w.path.startsWith("tenants/")) continue;
      expect(w.data.tenantId).toBe(TENANT_ID);
      const id = w.path.split("/")[1];
      expect(id.startsWith("demo_clim_") || id.startsWith("proposal_demo_clim_") || id.startsWith("contract_demo_clim_") || id === TENANT_ID).toBe(true);
    }
  });

  it("o catálogo cobra por unidade e pelo comprimento, e nunca por área ou faixa de altura", async () => {
    await seed();
    const modes = written()
      .filter((w) => w.path.startsWith("products/"))
      .map((w) => (w.data.pricingModel as { mode: string }).mode);
    expect(new Set(modes)).toEqual(new Set(["curtain_width", "standard"]));
  });

  it("a tubulação da sala sai do comprimento: 6 m a R$ 85/m com 40% de markup", async () => {
    await seed();
    const proposal = written().find((w) => w.path === "proposals/demo_clim_prop_1");
    const lines = proposal?.data.products as Array<{ productId: string; total: number }>;
    const tubulacao = lines.filter((l) => l.productId === "demo_clim_prod_tubulacao").map((l) => l.total);
    expect(tubulacao).toContain(714);
  });

  it("o split da sala sai por unidade: R$ 2.890 com 30% de markup", async () => {
    await seed();
    const proposal = written().find((w) => w.path === "proposals/demo_clim_prop_1");
    const lines = proposal?.data.products as Array<{ productId: string; total: number }>;
    const split = lines.filter((l) => l.productId === "demo_clim_prod_split18").map((l) => l.total);
    expect(split).toContain(3757);
  });

  it("proposta por ambiente: grupo com o id do ambiente e total igual à soma das linhas", async () => {
    await seed();
    const proposals = written().filter((w) => w.path.startsWith("proposals/"));
    expect(proposals).toHaveLength(3);
    for (const { data } of proposals) {
      const sistemas = data.sistemas as Array<{ sistemaId: string; ambientes: Array<{ ambienteId: string }> }>;
      for (const sistema of sistemas) {
        expect(sistema.ambientes).toHaveLength(1);
        expect(sistema.sistemaId).toBe(sistema.ambientes[0].ambienteId);
      }
      const lines = data.products as Array<{ total: number }>;
      const sum = Math.round(lines.reduce((acc, l) => acc + l.total, 0) * 100) / 100;
      expect(data.totalValue).toBe(sum);
      expect(sum).toBeGreaterThan(0);
    }
  });

  it("a obra de exemplo segue as etapas do nicho, da vistoria ao start-up", async () => {
    await seed();
    const project = written().find((w) => w.path === "projects/proposal_demo_clim_prop_1");
    const stages = (project?.data.stages as Array<{ name: string }>).map((s) => s.name);
    expect(stages).toEqual([
      "Vistoria e carga térmica",
      "Infraestrutura e tubulação",
      "Instalação das unidades",
      "Vácuo, carga de gás e testes",
      "Entrega e start-up",
    ]);
  });

  describe("PMOC de exemplo", () => {
    const pmocContract = () => written().find((w) => w.path === "service_contracts/demo_clim_ct_escritorio")!.data;
    const visits = () =>
      written()
        .filter((w) => w.path.startsWith("service_orders/") && w.data.contractId === "demo_clim_ct_escritorio")
        .map((w) => ({ id: w.path.split("/")[1], ...w.data }) as Record<string, unknown> & { id: string })
        .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));

    it("o contrato é PMOC, com prédio, itens dos aparelhos cobertos e visitas mensais", async () => {
      await seed();
      const contract = pmocContract();
      expect(contract.type).toBe("pmoc");
      expect((contract.visitPlan as { enabled: boolean; intervalMonths: number }).enabled).toBe(true);
      const pmoc = contract.pmoc as { responsibleId: string; building: Record<string, unknown>; items: PmocItem[] };
      expect(pmoc.building).toMatchObject({ occupants: 28, climatizedArea: 210, use: "Escritório" });
      expect(new Set(pmoc.items.map((i) => i.category))).toEqual(new Set(["split", "environment"]));
    });

    it("o responsável existe na demonstração, com a ART em dia", async () => {
      await seed();
      const pmoc = pmocContract().pmoc as { responsibleId: string };
      const responsible = written().find((w) => w.path === `technical_responsibles/${pmoc.responsibleId}`);
      expect(responsible?.data).toMatchObject({ tenantId: TENANT_ID, council: "CREA", active: true });
      expect(String(responsible?.data.artValidUntil) > new Date().toISOString().slice(0, 10)).toBe(true);
    });

    it("duas visitas feitas no id que a rotina usaria, a primeira com tudo e a âncora nela", async () => {
      await seed();
      const done = visits();
      expect(done).toHaveLength(2);
      const pmoc = pmocContract().pmoc as { items: PmocItem[]; anchorDate: string };
      expect(done[0].id).toBe(`contract_demo_clim_ct_escritorio_visit_${pmoc.anchorDate.replace(/-/g, "")}`);
      expect((done[0].checklist as unknown[]).length).toBe(pmoc.items.length);
      expect((done[1].checklist as unknown[]).length).toBeLessThan(pmoc.items.length);
      for (const visit of done) {
        expect(visit.status).toBe("completed");
        expect((visit.checklist as Array<{ id: string; done: boolean }>).every((c) => c.id.startsWith("pmoc_") && c.done)).toBe(true);
      }
      const next = (pmocContract().visitPlan as { nextVisitDate: string }).nextVisitDate;
      expect(next > new Date().toISOString().slice(0, 10)).toBe(true);
    });

    it("o relatório de execução tem o que mostrar: o mensal feito duas vezes", async () => {
      await seed();
      const pmoc = pmocContract().pmoc as { items: PmocItem[] };
      const executions = itemExecutions(pmoc.items, visits(), { from: "2000-01-01", to: "2100-12-31" });
      const monthly = executions.filter((e) => e.frequency === "Mensal");
      expect(monthly.length).toBeGreaterThan(0);
      expect(monthly.every((e) => e.timesDone === 2)).toBe(true);
      expect(executions.filter((e) => e.frequency === "Semestral").every((e) => e.timesDone === 1)).toBe(true);
    });
  });
});
