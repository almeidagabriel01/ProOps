/**
 * A demonstração de segurança eletrônica: tudo no tenant `demo-seguranca`, com
 * IDs próprios, propostas montadas a partir dos sistemas e a mensalidade de
 * manutenção como recorrência no financeiro.
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

const DEMO_SEGURANCA_TENANT_ID = DEMO_TENANT_IDS.seguranca_eletronica;
const seedDemoSegurancaTenant = () => seedDemo(DEMO_DATASETS.seguranca_eletronica);

type Written = { path: string; data: Record<string, unknown> };
const written = (): Written[] =>
  set.mock.calls.map(([ref, data]) => ({ path: (ref as { path: string }).path, data }));

beforeEach(() => {
  set.mockClear();
  commit.mockClear();
});

describe("seedDemoSegurancaTenant", () => {
  it("é o tenant de demonstração do nicho de segurança", async () => {
    expect(DEMO_SEGURANCA_TENANT_ID).toBe(DEMO_TENANT_IDS.seguranca_eletronica);
    await seedDemoSegurancaTenant();
    const tenant = written().find((w) => w.path === `tenants/${DEMO_SEGURANCA_TENANT_ID}`);
    expect(tenant?.data).toMatchObject({ niche: "seguranca_eletronica", isDemo: true });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("todo documento é do tenant de demonstração e tem id próprio", async () => {
    await seedDemoSegurancaTenant();
    for (const w of written()) {
      if (w.path.startsWith("tenants/")) continue;
      expect(w.data.tenantId).toBe(DEMO_SEGURANCA_TENANT_ID);
      const id = w.path.split("/")[1];
      expect(id.startsWith("demo_seg_") || id.startsWith("proposal_demo_seg_") || id.startsWith("contract_demo_seg_") || id === DEMO_SEGURANCA_TENANT_ID).toBe(true);
    }
  });

  it("propostas com o markup do catálogo e total igual à soma das linhas", async () => {
    await seedDemoSegurancaTenant();
    const proposals = written().filter((w) => w.path.startsWith("proposals/"));
    expect(proposals).toHaveLength(3);
    for (const { data } of proposals) {
      const lines = data.products as Array<{ total: number; unitPrice: number; quantity: number; markup: number }>;
      for (const line of lines) {
        expect(line.total).toBeCloseTo(line.quantity * line.unitPrice * (1 + line.markup / 100), 2);
      }
      const sum = Math.round(lines.reduce((acc, l) => acc + l.total, 0) * 100) / 100;
      expect(data.totalValue).toBe(sum);
    }
  });

  it("a mensalidade de manutenção é recorrente no financeiro", async () => {
    await seedDemoSegurancaTenant();
    const recurring = written().filter(
      (w) => w.path.startsWith("transactions/") && w.data.isRecurring === true,
    );
    expect(recurring.length).toBeGreaterThanOrEqual(2);
    expect(new Set(recurring.map((w) => w.data.recurringGroupId)).size).toBe(1);
  });
});
