/**
 * A demonstração de persianas e toldos: tudo no tenant `demo-cortinas`, com
 * IDs que não colidem com os da demonstração de automação, catálogo por medida
 * e propostas por ambiente com o total igual à soma das linhas.
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

const DEMO_CORTINAS_TENANT_ID = DEMO_TENANT_IDS.cortinas;
const seedDemoCortinasTenant = () => seedDemo(DEMO_DATASETS.cortinas);

type Written = { path: string; data: Record<string, unknown> };
const written = (): Written[] =>
  set.mock.calls.map(([ref, data]) => ({ path: (ref as { path: string }).path, data }));

beforeEach(() => {
  set.mockClear();
  commit.mockClear();
});

describe("seedDemoCortinasTenant", () => {
  it("é o tenant de demonstração do nicho cortinas", async () => {
    expect(DEMO_CORTINAS_TENANT_ID).toBe(DEMO_TENANT_IDS.cortinas);
    await seedDemoCortinasTenant();
    const tenant = written().find((w) => w.path === `tenants/${DEMO_CORTINAS_TENANT_ID}`);
    expect(tenant?.data).toMatchObject({ niche: "cortinas", isDemo: true });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("todo documento é do tenant de demonstração e tem id próprio", async () => {
    await seedDemoCortinasTenant();
    for (const w of written()) {
      if (w.path.startsWith("tenants/")) continue;
      expect(w.data.tenantId).toBe(DEMO_CORTINAS_TENANT_ID);
      const id = w.path.split("/")[1];
      expect(id.startsWith("demo_cort_") || id.startsWith("proposal_demo_cort_") || id.startsWith("contract_demo_cort_") || id === DEMO_CORTINAS_TENANT_ID).toBe(true);
    }
  });

  it("o catálogo tem os três modos por medida", async () => {
    await seedDemoCortinasTenant();
    const modes = written()
      .filter((w) => w.path.startsWith("products/"))
      .map((w) => (w.data.pricingModel as { mode: string }).mode);
    expect(new Set(modes)).toEqual(new Set(["curtain_meter", "curtain_height", "curtain_width", "standard"]));
  });

  it("proposta por ambiente: grupo com o id do ambiente e total igual à soma das linhas", async () => {
    await seedDemoCortinasTenant();
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
});
