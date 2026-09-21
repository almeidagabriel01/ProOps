jest.mock("../../../init", () => ({ db: {}, auth: {} }));
jest.mock("firebase-admin/storage", () => ({ getStorage: jest.fn() }));
jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { increment: (n: number) => ({ __increment: n }) },
}));
jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("../../../lib/contact-validation", () => ({ normalizeBrazilPhoneNumber: () => "" }));

import {
  buildPurgeStages,
  processTenantPurgeJob,
  type PurgeStage,
  type TenantPurgeDeps,
  type TenantPurgeJob,
} from "../tenant-purge.service";

function makeDeps(
  job: Partial<TenantPurgeJob> | null,
  runStage: (stage: PurgeStage, call: number) => "done" | "partial",
) {
  const saves: Array<Record<string, unknown>> = [];
  const ran: PurgeStage[] = [];
  let clock = 1_000;
  const deps: TenantPurgeDeps = {
    loadJob: async () =>
      job ? ({ tenantId: "t1", requestedBy: "sa", createdAt: "x", stageIndex: 0, status: "pending", ...job } as TenantPurgeJob) : null,
    saveJob: async (_id, patch) => {
      saves.push(patch);
    },
    runStage: async (_id, stage) => {
      ran.push(stage);
      return runStage(stage, ran.length);
    },
    now: () => clock++,
  };
  return { deps, saves, ran };
}

describe("buildPurgeStages", () => {
  it("usuarios primeiro, finalizacao por ultimo, e notas fiscais fora", () => {
    const stages = buildPurgeStages();
    expect(stages[0]).toEqual({ kind: "users" });
    expect(stages[stages.length - 1]).toEqual({ kind: "finalize" });
    const collections = stages.flatMap((s) => ("collection" in s ? [s.collection] : []));
    expect(collections).toEqual(expect.arrayContaining(["proposals", "kanban_statuses", "calendar_events", "fiscal_settings"]));
    expect(collections).not.toContain("invoices");
    expect(collections).not.toContain("received_invoices");
  });
});

describe("processTenantPurgeJob", () => {
  it("roda todas as etapas e termina como completed", async () => {
    const { deps, saves, ran } = makeDeps({}, () => "done");
    await expect(processTenantPurgeJob("t1", Number.MAX_SAFE_INTEGER, deps)).resolves.toBe("completed");
    expect(ran).toHaveLength(buildPurgeStages().length);
    expect(saves[0]).toMatchObject({ status: "running" });
    expect(saves[saves.length - 1]).toMatchObject({ status: "completed" });
  });

  it("etapa parcial devolve o job para pending no mesmo indice (retomavel)", async () => {
    const { deps, saves } = makeDeps({}, (_stage, call) => (call === 3 ? "partial" : "done"));
    await expect(processTenantPurgeJob("t1", Number.MAX_SAFE_INTEGER, deps)).resolves.toBe("continued");
    expect(saves[saves.length - 1]).toMatchObject({
      status: "pending",
      stageIndex: 2,
      continuationKick: { __increment: 1 },
    });
  });

  it("retoma do indice gravado sem repetir etapas", async () => {
    const { deps, ran } = makeDeps({ stageIndex: 5 }, () => "done");
    await processTenantPurgeJob("t1", Number.MAX_SAFE_INTEGER, deps);
    expect(ran[0]).toEqual(buildPurgeStages()[5]);
  });

  it("prazo esgotado antes de uma etapa tambem continua depois", async () => {
    const { deps, saves, ran } = makeDeps({}, () => "done");
    await expect(processTenantPurgeJob("t1", 0, deps)).resolves.toBe("continued");
    expect(ran).toHaveLength(0);
    expect(saves[saves.length - 1]).toMatchObject({ status: "pending", stageIndex: 0 });
  });

  it("erro marca failed com o motivo e propaga", async () => {
    const { deps, saves } = makeDeps({}, () => {
      throw new Error("boom");
    });
    await expect(processTenantPurgeJob("t1", Number.MAX_SAFE_INTEGER, deps)).rejects.toThrow("boom");
    expect(saves[saves.length - 1]).toMatchObject({ status: "failed", lastError: "boom", stageIndex: 0 });
  });

  it.each(["running", "completed", "failed"] as const)("job %s nao e reprocessado", async (status) => {
    const { deps, ran } = makeDeps({ status }, () => "done");
    await expect(processTenantPurgeJob("t1", Number.MAX_SAFE_INTEGER, deps)).resolves.toBe("skipped");
    expect(ran).toHaveLength(0);
  });

  it("sem job nao faz nada", async () => {
    const { deps, ran } = makeDeps(null, () => "done");
    await expect(processTenantPurgeJob("t1", Number.MAX_SAFE_INTEGER, deps)).resolves.toBe("skipped");
    expect(ran).toHaveLength(0);
  });
});
