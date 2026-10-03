/**
 * Com mais de 250 assinaturas manuais expirando no mesmo dia (2 escritas cada:
 * user + espelho no tenant), o batch único passava de 500 escritas e falhava
 * inteiro. createChunkedBatch divide em lotes de até 400.
 */
type Filter = [string, string, unknown];
type Write = { kind: "update" | "set"; path: string; data: Record<string, unknown> };

const commits: number[] = [];
const writes: Write[] = [];
const queries: Filter[][] = [];
let usersByQuery: Array<Array<{ id: string; data: Record<string, unknown> }>> = [];

function ref(path: string) {
  return { path } as unknown as FirebaseFirestore.DocumentReference;
}

jest.mock("./init", () => ({
  db: {
    batch: () => {
      let count = 0;
      return {
        update: (r: { path: string }, data: Record<string, unknown>) => {
          count += 1;
          writes.push({ kind: "update", path: r.path, data });
        },
        set: (r: { path: string }, data: Record<string, unknown>) => {
          count += 1;
          writes.push({ kind: "set", path: r.path, data });
        },
        commit: async () => void commits.push(count),
      };
    },
    collection: (name: string) => {
      const filters: Filter[] = [];
      const query = {
        where: (field: string, op: string, value: unknown) => {
          filters.push([field, op, value]);
          return query;
        },
        get: async () => {
          queries.push(filters);
          const docs = (usersByQuery.shift() || []).map((u) => ({
            ref: ref(`${name}/${u.id}`),
            data: () => u.data,
          }));
          return { empty: docs.length === 0, docs };
        },
        doc: (id: string) => ref(`${name}/${id}`),
      };
      return query;
    },
  },
}));
jest.mock("firebase-functions/v2/scheduler", () => ({ onSchedule: () => () => undefined }));
jest.mock("./lib/observability/error-logger", () => ({ captureError: jest.fn() }));

import { createChunkedBatch, runManualSubscriptionCheck } from "./checkManualSubscriptions";

beforeEach(() => {
  commits.length = 0;
  writes.length = 0;
  queries.length = 0;
  usersByQuery = [];
});

it("divide 600 escritas em lotes de no máximo 400", async () => {
  const batch = createChunkedBatch();
  const r = ref("x");
  for (let i = 0; i < 300; i++) {
    batch.update(r, { subscriptionStatus: "past_due" });
    batch.set(r, { subscriptionStatus: "past_due" }, { merge: true });
  }
  await batch.commit();
  expect(commits).toEqual([400, 200]);
});

it("poucas escritas continuam num lote só", async () => {
  const batch = createChunkedBatch();
  const r = ref("x");
  batch.update(r, { a: 1 });
  batch.update(r, { a: 2 });
  await batch.commit();
  expect(commits).toEqual([2]);
});

describe("runManualSubscriptionCheck", () => {
  // 16/09/2027 10:00 em Brasilia
  const NOW = new Date("2027-09-16T13:00:00.000Z");

  it("compara com o dia de hoje em Brasilia, nao com o ISO de agora", async () => {
    await runManualSubscriptionCheck(NOW);
    expect(queries[0]).toContainEqual(["currentPeriodEnd", "<", "2027-09-16"]);
    expect(queries[1]).toContainEqual(["currentPeriodEnd", "<", "2027-09-09"]);
  });

  it("vencido passa para past_due COM pastDueSince no user e no tenant (o bug: bloqueava no 1o dia)", async () => {
    usersByQuery = [
      [{ id: "u1", data: { tenantId: "t1", currentPeriodEnd: "2027-09-14" } }],
      [],
    ];
    const result = await runManualSubscriptionCheck(NOW);

    expect(result).toEqual({ pastDue: 1, canceled: 0 });
    expect(writes).toEqual([
      expect.objectContaining({
        path: "users/u1",
        data: expect.objectContaining({ subscriptionStatus: "past_due", pastDueSince: "2027-09-15T03:00:00.000Z" }),
      }),
      expect.objectContaining({
        path: "tenants/t1",
        data: expect.objectContaining({ subscriptionStatus: "past_due", pastDueSince: "2027-09-15T03:00:00.000Z" }),
      }),
    ]);
  });

  it("data gravada como ISO da meia-noite UTC conta pelo dia do contrato", async () => {
    usersByQuery = [
      [{ id: "u1", data: { tenantId: "t1", currentPeriodEnd: "2027-09-14T00:00:00.000Z" } }],
      [],
    ];
    await runManualSubscriptionCheck(NOW);
    expect(writes[0].data.pastDueSince).toBe("2027-09-15T03:00:00.000Z");
  });

  it("nao mexe em quem ainda esta no ultimo dia do contrato", async () => {
    usersByQuery = [[{ id: "u1", data: { tenantId: "t1", currentPeriodEnd: "2027-09-16" } }], []];
    const result = await runManualSubscriptionCheck(NOW);
    expect(result.pastDue).toBe(0);
    expect(writes).toEqual([]);
  });

  it("passada a carencia vira canceled + free e limpa pastDueSince", async () => {
    usersByQuery = [[], [{ id: "u1", data: { tenantId: "t1", currentPeriodEnd: "2027-09-08" } }]];
    const result = await runManualSubscriptionCheck(NOW);

    expect(result).toEqual({ pastDue: 0, canceled: 1 });
    expect(writes).toEqual([
      expect.objectContaining({
        path: "users/u1",
        data: expect.objectContaining({ subscriptionStatus: "canceled", planId: "free", pastDueSince: null }),
      }),
      expect.objectContaining({
        path: "tenants/t1",
        data: expect.objectContaining({ subscriptionStatus: "canceled", plan: "free", pastDueSince: null }),
      }),
    ]);
  });

  it("ainda dentro da carencia nao cancela", async () => {
    usersByQuery = [[], [{ id: "u1", data: { tenantId: "t1", currentPeriodEnd: "2027-09-09" } }]];
    const result = await runManualSubscriptionCheck(NOW);
    expect(result.canceled).toBe(0);
  });

  it("usuario sem tenant atualiza so o proprio doc", async () => {
    usersByQuery = [[{ id: "u1", data: { currentPeriodEnd: "2027-09-14" } }], []];
    await runManualSubscriptionCheck(NOW);
    expect(writes.map((w) => w.path)).toEqual(["users/u1"]);
  });
});
