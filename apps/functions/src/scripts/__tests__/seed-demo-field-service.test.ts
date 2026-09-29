import { buildDemoDocs } from "../demo/engine";
import { DEMO_DATASETS } from "../demo/datasets";
import { signatureContentHash } from "../../api/services/field-service/field-service-model";

/**
 * A demonstração de cada nicho mostra a assistência técnica por inteiro: uma
 * OS concluída e assinada, uma agendada e uma aberta, com os equipamentos do
 * mesmo cliente. A assinatura precisa bater com o conteúdo, senão o "código
 * de conferência" da tela seria de outra OS.
 */
const OPTS = {
  now: new Date("2026-09-29T12:00:00.000Z"),
  timestamp: (ms: number) => new Date(ms),
};

describe.each(Object.values(DEMO_DATASETS).map((ds) => [ds.niche, ds] as const))("assistência na demonstração de %s", (_niche, ds) => {
  const writes = buildDemoDocs(ds, OPTS);
  const docs = (prefix: string) =>
    writes.filter((w) => w.op === "set" && w.path.startsWith(prefix)).map((w) => (w as { data: Record<string, unknown> }).data);
  const orders = docs("service_orders/");
  const equipment = docs("customer_equipment/");

  it("tem uma OS de cada estado da fila", () => {
    expect(orders.map((o) => o.status).sort()).toEqual(["completed", "open", "scheduled"]);
    expect(new Set(orders.map((o) => o.code)).size).toBe(orders.length);
  });

  it("todo equipamento da OS é do cliente dela", () => {
    const byId = new Map(
      writes
        .filter((w) => w.op === "set" && w.path.startsWith("customer_equipment/"))
        .map((w) => [w.path.split("/")[1], (w as { data: Record<string, unknown> }).data]),
    );
    for (const order of orders) {
      for (const id of order.equipmentIds as string[]) {
        expect(byId.get(id)?.clientId).toBe(order.clientId);
      }
    }
    expect(equipment.every((e) => e.tenantId === ds.tenantId)).toBe(true);
  });

  it("a concluída tem assinatura que confere com o conteúdo", () => {
    const done = orders.find((o) => o.status === "completed")!;
    const signature = done.signature as { contentHash: string; name: string };
    expect(signature.name).toBeTruthy();
    expect(signature.contentHash).toBe(signatureContentHash(done));
    expect((done.totals as { total: number }).total).toBeGreaterThan(0);
  });

  it("o contador continua depois da última OS", () => {
    const counter = docs("service_order_counters/")[0];
    expect(counter.nextNumber).toBe(Math.max(...orders.map((o) => o.number as number)) + 1);
  });
});
