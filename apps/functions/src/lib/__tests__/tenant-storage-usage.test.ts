/**
 * Contagem de armazenamento. Evento de Storage e entregue AO MENOS uma vez:
 * sem o registro do id do evento, uma reentrega contaria o arquivo duas vezes
 * e a empresa seria barrada antes do teto.
 */

const docs = new Map<string, Record<string, unknown>>();
const txSets: Array<{ id: string; data: Record<string, unknown> }> = [];
const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

function ref(id: string) {
  return {
    id,
    collection: (sub: string) => ({ doc: (sid: string) => ref(`${id}/${sub}/${sid}`) }),
    get: async () => snap(id),
    update: async (data: Record<string, unknown>) => updates.push({ id, data }),
  };
}
function snap(id: string) {
  const data = docs.get(id);
  return { exists: data !== undefined, get: (f: string) => data?.[f] };
}

jest.mock("../../init", () => ({
  db: {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        get: async (r: { id: string }) => snap(r.id),
        set: (r: { id: string }, data: Record<string, unknown>) => {
          txSets.push({ id: r.id, data });
          docs.set(r.id, { ...(docs.get(r.id) ?? {}), ...data });
        },
      }),
  },
}));
jest.mock("../logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
let quota = 200;
jest.mock("../tenant-plan-policy", () => ({
  getTenantPlanProfile: async () => ({ limits: { storageQuotaMB: quota } }),
}));

import { applyStorageDelta, refreshStorageQuotaFlag } from "../tenant-storage-usage";

const MB = 1024 * 1024;
const USAGE = "tenant_storage_usage/t1";

beforeEach(() => {
  docs.clear();
  txSets.length = 0;
  updates.length = 0;
  quota = 200;
});

it("soma o arquivo e marca estouro ao chegar no teto", async () => {
  await applyStorageDelta({ tenantId: "t1", deltaBytes: 150 * MB, eventId: "e1" });
  expect(docs.get(USAGE)).toMatchObject({ storageBytes: 150 * MB, overQuota: false });

  await applyStorageDelta({ tenantId: "t1", deltaBytes: 50 * MB, eventId: "e2" });
  expect(docs.get(USAGE)).toMatchObject({ storageBytes: 200 * MB, overQuota: true });
});

it("reentrega do mesmo evento nao conta duas vezes", async () => {
  await applyStorageDelta({ tenantId: "t1", deltaBytes: 10 * MB, eventId: "e1" });
  await applyStorageDelta({ tenantId: "t1", deltaBytes: 10 * MB, eventId: "e1" });
  expect(docs.get(USAGE)).toMatchObject({ storageBytes: 10 * MB });
});

it("apagar libera e nunca deixa o uso negativo", async () => {
  docs.set(USAGE, { storageBytes: 200 * MB, overQuota: true });
  await applyStorageDelta({ tenantId: "t1", deltaBytes: -300 * MB, eventId: "e3" });
  expect(docs.get(USAGE)).toMatchObject({ storageBytes: 0, overQuota: false });
});

it("upgrade de plano tira a trava sem esperar arquivo nenhum", async () => {
  docs.set(USAGE, { storageBytes: 250 * MB, overQuota: true });
  quota = 2560;
  await refreshStorageQuotaFlag("t1");
  expect(updates[0]).toMatchObject({ id: USAGE, data: { overQuota: false } });
});

it("downgrade trava quem ja passou do teto novo", async () => {
  docs.set(USAGE, { storageBytes: 500 * MB, overQuota: false });
  quota = 200;
  await refreshStorageQuotaFlag("t1");
  expect(updates[0]).toMatchObject({ data: { overQuota: true } });
});

it("flag ja correta nao gera escrita", async () => {
  docs.set(USAGE, { storageBytes: 1 * MB, overQuota: false });
  await refreshStorageQuotaFlag("t1");
  expect(updates).toHaveLength(0);
});
