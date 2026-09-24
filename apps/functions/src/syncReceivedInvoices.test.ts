/**
 * Recepcao de notas de entrada e so do Enterprise. Quem perdeu o plano com o
 * flag ligado nao pode seguir sendo sincronizado como se nada tivesse mudado.
 */

const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
jest.mock("./init", () => ({
  db: {
    collection: () => ({
      where: () => ({ limit: () => ({ get: async () => ({ docs }) }) }),
    }),
  },
}));
const warn = jest.fn();
jest.mock("./lib/logger", () => ({
  logger: { info: jest.fn(), warn: (...a: unknown[]) => warn(...a), error: jest.fn() },
}));
jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: (_opts: unknown, handler: () => Promise<void>) => handler,
}));
jest.mock("./deploymentConfig", () => ({ SCHEDULE_OPTIONS: {} }));
const syncTenant = jest.fn(async (_id: string) => ({ applied: 1 }));
jest.mock("./api/services/fiscal/received-invoice.service", () => ({
  syncReceivedInvoices: (id: string) => syncTenant(id),
}));
const tenantHasCapability = jest.fn();
jest.mock("./lib/tenant-capabilities", () => ({
  tenantHasCapability: (id: string, cap: string) => tenantHasCapability(id, cap),
}));

import { syncReceivedInvoices } from "./syncReceivedInvoices";

const run = syncReceivedInvoices as unknown as () => Promise<void>;

beforeEach(() => {
  jest.clearAllMocks();
  docs.length = 0;
  docs.push(
    { id: "ent", data: () => ({ tenantId: "ent" }) },
    { id: "rebaixado", data: () => ({ tenantId: "rebaixado" }) },
  );
  tenantHasCapability.mockImplementation(async (id: string) => id === "ent");
});

it("sincroniza so quem tem a recepcao no plano e avisa sobre quem perdeu", async () => {
  await run();

  expect(syncTenant).toHaveBeenCalledTimes(1);
  expect(syncTenant).toHaveBeenCalledWith("ent");
  expect(tenantHasCapability).toHaveBeenCalledWith("rebaixado", "fiscalReceiving");
  expect(warn).toHaveBeenCalledWith("fiscal_receiving_sem_plano", { tenantId: "rebaixado" });
});
