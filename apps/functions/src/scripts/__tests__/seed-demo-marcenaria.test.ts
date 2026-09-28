/**
 * A demonstração de marcenaria e móveis planejados: tudo no tenant `demo-marcenaria`,
 * com IDs próprios, armário e painel por m², cozinha por metro linear,
 * ferragem e iluminação por unidade, e
 * propostas por ambiente com o total igual à soma das linhas.
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

const TENANT_ID = DEMO_TENANT_IDS.marcenaria;
const seed = () => seedDemo(DEMO_DATASETS.marcenaria);

type Written = { path: string; data: Record<string, unknown> };
const written = (): Written[] =>
  set.mock.calls.map(([ref, data]) => ({ path: (ref as { path: string }).path, data }));

beforeEach(() => {
  set.mockClear();
  commit.mockClear();
});

describe("demonstração de marcenaria e móveis planejados", () => {
  it("é o tenant de demonstração do nicho", async () => {
    expect(TENANT_ID).toBe("demo-marcenaria");
    await seed();
    const tenant = written().find((w) => w.path === `tenants/${TENANT_ID}`);
    expect(tenant?.data).toMatchObject({ niche: "marcenaria", isDemo: true });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("todo documento é do tenant de demonstração e tem id próprio", async () => {
    await seed();
    for (const w of written()) {
      if (w.path.startsWith("tenants/")) continue;
      expect(w.data.tenantId).toBe(TENANT_ID);
      const id = w.path.split("/")[1];
      expect(id.startsWith("demo_marc_") || id.startsWith("proposal_demo_marc_") || id === TENANT_ID).toBe(true);
    }
  });

  it("o catálogo cobra por m², por metro linear e por unidade, e nunca por faixa de altura", async () => {
    await seed();
    const modes = written()
      .filter((w) => w.path.startsWith("products/"))
      .map((w) => (w.data.pricingModel as { mode: string }).mode);
    expect(new Set(modes)).toEqual(new Set(["curtain_meter", "curtain_width", "standard"]));
  });

  it("a cozinha sai do metro linear: 3,2 m a R$ 1.200/m com 50% de markup", async () => {
    await seed();
    const proposal = written().find((w) => w.path === "proposals/demo_marc_prop_1");
    const lines = proposal?.data.products as Array<{ productId: string; total: number }>;
    const cozinha = lines.filter((l) => l.productId === "demo_marc_prod_cozinha").map((l) => l.total);
    expect(cozinha).toContain(5760);
  });

  it("o roupeiro sai da área de frente: 2,8 x 2,6 m a R$ 850/m² com 60% de markup", async () => {
    await seed();
    const proposal = written().find((w) => w.path === "proposals/demo_marc_prop_1");
    const lines = proposal?.data.products as Array<{ productId: string; total: number }>;
    const armario = lines.filter((l) => l.productId === "demo_marc_prod_armario").map((l) => l.total);
    expect(armario).toContain(9900.8);
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

  it("a obra de exemplo segue as etapas do nicho, da medição à entrega, com projeto e montagem", async () => {
    await seed();
    const project = written().find((w) => w.path === "projects/proposal_demo_marc_prop_1");
    const stages = (project?.data.stages as Array<{ name: string }>).map((s) => s.name);
    expect(stages).toEqual(["Medição", "Projeto", "Produção", "Montagem", "Entrega"]);
  });
});
