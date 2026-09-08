/**
 * Fila de entrega no Drive.
 *
 * Ela existe para tirar o Chromium da request do usuario. As coisas que erram
 * em silencio aqui:
 *
 * 1. **Job por proposta, id deterministico.** Salvar cinco vezes seguidas nao
 *    pode virar cinco renders do mesmo PDF.
 * 2. **Falha nao pode virar entrega perdida.** O ponto de sair da request e
 *    justamente nao perder trabalho; um job que falha tem que voltar com
 *    backoff, e desistir com registro depois de N tentativas.
 * 3. **Uma proposta ruim nao derruba o lote.** O processamento e por
 *    documento, e o erro de um nao pode abortar os outros.
 */

const docs = new Map<string, Record<string, unknown>>();
const queryResult: Array<{ id: string }> = [];
const syncProposalToDrive = jest.fn();
let ultimaConsulta: Array<Record<string, unknown>> = [];

function makeDocRef(collection: string, id: string) {
  const key = `${collection}/${id}`;
  return {
    id,
    get: async () => ({
      exists: docs.has(key),
      data: () => docs.get(key),
    }),
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      docs.set(key, options?.merge ? { ...docs.get(key), ...data } : data);
    },
    update: async (data: Record<string, unknown>) => {
      docs.set(key, { ...docs.get(key), ...data });
    },
  };
}

jest.mock("../../../init", () => ({
  db: {
    collection: (collection: string) => {
      const chain = {
        doc: (id: string) => makeDocRef(collection, id),
        where(campo: string, op: string, valor: unknown) {
          ultimaConsulta.push({ campo, op, valor });
          return chain;
        },
        orderBy(campo: string, direcao: string) {
          ultimaConsulta.push({ campo, direcao });
          return chain;
        },
        limit: () => chain,
        get: async () => ({
          size: queryResult.length,
          docs: queryResult.map((d) => ({ id: d.id })),
        }),
      };
      return chain;
    },
  },
}));

jest.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: () => ({ __ts: true }) },
}));

jest.mock("../../../lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("./proposal-drive-sync.service", () => ({
  syncProposalToDrive: (...args: unknown[]) => syncProposalToDrive(...args),
}));

import {
  DRIVE_DELIVERY_JOBS_COLLECTION,
  MAX_DRIVE_DELIVERY_ATTEMPTS,
  buildDriveDeliveryJobId,
  enqueueDriveDelivery,
  processDriveDeliveryQueue,
  runDriveDeliveryJob,
} from "./drive-delivery-queue";

const JOB_ID = "t1_p1";

function job(): Record<string, unknown> {
  return docs.get(`${DRIVE_DELIVERY_JOBS_COLLECTION}/${JOB_ID}`)!;
}

function seedProposal() {
  docs.set("proposals/p1", { tenantId: "t1", title: "Casa" });
}

beforeEach(() => {
  docs.clear();
  queryResult.length = 0;
  ultimaConsulta = [];
  jest.clearAllMocks();
  syncProposalToDrive.mockResolvedValue(undefined);
  seedProposal();
});

describe("enqueueDriveDelivery", () => {
  it("cria o job pendente e vencido, para o proximo ciclo pegar", async () => {
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });

    expect(job().status).toBe("pending");
    expect(job().attempts).toBe(0);
    expect(new Date(job().nextRunAt as string).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it("salvar varias vezes mantem UM job, nao varios renders", async () => {
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });

    expect(docs.size).toBe(2); // a proposta + um unico job
    expect(buildDriveDeliveryJobId("t1", "p1")).toBe(JOB_ID);
  });

  it("reabre um job ja entregue quando ha mudanca nova", async () => {
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    await runDriveDeliveryJob(JOB_ID);
    expect(job().status).toBe("delivered");

    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    expect(job().status).toBe("pending");
    expect(job().attempts).toBe(0);
  });

  it("ignora chamada sem tenant ou sem proposta", async () => {
    await enqueueDriveDelivery({ tenantId: "", proposalId: "p1" });
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "" });
    expect(docs.size).toBe(1); // so a proposta do seed
  });
});

describe("runDriveDeliveryJob", () => {
  it("entrega e marca o job", async () => {
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    await runDriveDeliveryJob(JOB_ID);

    expect(syncProposalToDrive).toHaveBeenCalledWith({
      tenantId: "t1",
      proposalId: "p1",
      proposalData: { tenantId: "t1", title: "Casa" },
    });
    expect(job().status).toBe("delivered");
    expect(job().attempts).toBe(1);
  });

  it("nao reentrega um job ja concluido", async () => {
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    await runDriveDeliveryJob(JOB_ID);
    await runDriveDeliveryJob(JOB_ID);

    expect(syncProposalToDrive).toHaveBeenCalledTimes(1);
  });

  it("falha volta para a fila com backoff, sem perder a entrega", async () => {
    syncProposalToDrive.mockRejectedValue(new Error("ECONNRESET"));
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    await runDriveDeliveryJob(JOB_ID);

    expect(job().status).toBe("pending");
    expect(job().attempts).toBe(1);
    expect(job().lastError).toBe("ECONNRESET");
    expect(new Date(job().nextRunAt as string).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("desiste depois do teto de tentativas, deixando o motivo registrado", async () => {
    syncProposalToDrive.mockRejectedValue(new Error("invalid_grant"));
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });

    for (let i = 0; i < MAX_DRIVE_DELIVERY_ATTEMPTS; i += 1) {
      docs.set(`${DRIVE_DELIVERY_JOBS_COLLECTION}/${JOB_ID}`, {
        ...job(),
        status: "pending",
      });
      await runDriveDeliveryJob(JOB_ID);
    }

    expect(job().status).toBe("failed");
    expect(job().attempts).toBe(MAX_DRIVE_DELIVERY_ATTEMPTS);
    expect(job().lastError).toBe("invalid_grant");
  });

  it("proposta apagada encerra o job em vez de tentar para sempre", async () => {
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    docs.delete("proposals/p1");

    await runDriveDeliveryJob(JOB_ID);

    expect(syncProposalToDrive).not.toHaveBeenCalled();
    expect(job().status).toBe("failed");
    expect(job().lastError).toBe("PROPOSAL_NOT_FOUND");
  });

  it("job inexistente nao explode", async () => {
    await expect(runDriveDeliveryJob("nao_existe")).resolves.toBeUndefined();
  });
});

describe("processDriveDeliveryQueue", () => {
  it("busca so os pendentes vencidos, ordenados", async () => {
    await processDriveDeliveryQueue();

    expect(ultimaConsulta).toEqual([
      { campo: "status", op: "==", valor: "pending" },
      { campo: "nextRunAt", op: "<=", valor: expect.any(String) },
      // orderBy explicito: intervalo sem ele assume ASC e pede outro indice,
      // e a falha so aparece em runtime.
      { campo: "nextRunAt", direcao: "asc" },
    ]);
  });

  it("uma proposta com erro nao derruba o lote", async () => {
    await enqueueDriveDelivery({ tenantId: "t1", proposalId: "p1" });
    docs.set(`${DRIVE_DELIVERY_JOBS_COLLECTION}/t1_p2`, {
      tenantId: "t1",
      proposalId: "p2",
      status: "pending",
      attempts: 0,
      nextRunAt: new Date().toISOString(),
    });
    docs.set("proposals/p2", { tenantId: "t1", title: "Outra" });

    syncProposalToDrive.mockRejectedValueOnce(new Error("falhou"));
    queryResult.push({ id: JOB_ID }, { id: "t1_p2" });

    const { processed } = await processDriveDeliveryQueue();

    expect(processed).toBe(2);
    expect(syncProposalToDrive).toHaveBeenCalledTimes(2);
    expect(
      docs.get(`${DRIVE_DELIVERY_JOBS_COLLECTION}/t1_p2`)!.status,
    ).toBe("delivered");
  });
});
