/**
 * handleTransactionTotalsEvent: mantém totais/grouped no próprio doc e os
 * resumos em transaction_groups. Fake Firestore em memória — sem emulador.
 */

import { handleTransactionTotalsEvent } from "./onTransactionTotals";

type FakeDoc = { id: string; data: Record<string, unknown> };

type Ts = { seconds: number; nanoseconds: number };

/**
 * Relógio do fake: cada consulta de membros recebe um readTime crescente, como
 * no Firestore real. `clock.now` pode ser ajustado pelo teste.
 */
function makeFakeFirestore(members: FakeDoc[], clock = { now: 1000 }) {
  const groupSets = new Map<string, Record<string, unknown>>();
  const groupDeletes: string[] = [];
  const syncDocs = new Map<string, Record<string, unknown>>();
  let transactionQueries = 0;

  const tsOf = (seconds: number): Ts => ({ seconds, nanoseconds: 0 });

  const makeQuery = (filters: Array<[string, unknown]>) => ({
    where(field: string, _op: string, value: unknown) {
      return makeQuery([...filters, [field, value]]);
    },
    limit() {
      return this;
    },
    async get() {
      transactionQueries += 1;
      clock.now += 1;
      const docs = members
        .filter((d) => filters.every(([f, v]) => d.data[f] === v))
        .map((d) => ({ id: d.id, data: () => d.data }));
      return { docs, empty: docs.length === 0, readTime: tsOf(clock.now) };
    },
  });

  const groupDoc = (id: string) => ({
    __kind: "group" as const,
    id,
    async set(data: Record<string, unknown>) {
      groupSets.set(id, data);
    },
    async delete() {
      groupDeletes.push(id);
    },
  });
  const syncDoc = (id: string) => ({
    __kind: "sync" as const,
    id,
    async get() {
      const data = syncDocs.get(id);
      return { exists: data !== undefined, data: () => data };
    },
  });

  const firestore = {
    collection(name: string) {
      if (name === "transactions") return makeQuery([]);
      if (name === "transaction_groups") return { doc: groupDoc };
      if (name === "transaction_group_sync") return { doc: syncDoc };
      throw new Error(`unexpected collection ${name}`);
    },
    async runTransaction(fn: (t: unknown) => Promise<void>) {
      const t = {
        get: (ref: ReturnType<typeof syncDoc>) => ref.get(),
        set: (ref: { __kind: string; id: string }, data: Record<string, unknown>) => {
          if (ref.__kind === "sync") syncDocs.set(ref.id, data);
          else groupSets.set(ref.id, data);
        },
        delete: (ref: { id: string }) => {
          groupDeletes.push(ref.id);
        },
      };
      await fn(t);
    },
  };

  return {
    firestore,
    groupSets,
    groupDeletes,
    syncDocs,
    clock,
    tsOf,
    transactionQueries: () => transactionQueries,
  };
}

function makeEvent(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  firestore: unknown,
) {
  const updateMock = jest.fn(async () => undefined);
  const beforeSnap = before
    ? { exists: true, data: () => before, ref: { firestore, update: updateMock } }
    : { exists: false, data: () => undefined, ref: { firestore, update: updateMock } };
  const afterSnap = after
    ? { exists: true, data: () => after, ref: { firestore, update: updateMock } }
    : { exists: false, data: () => undefined, ref: { firestore, update: updateMock } };
  return {
    event: {
      data: { before: beforeSnap, after: afterSnap },
      params: { transactionId: "tx1" },
    },
    updateMock,
  };
}

const baseMember = (over: Record<string, unknown>): Record<string, unknown> => ({
  tenantId: "t1",
  type: "expense",
  amount: 50,
  status: "pending",
  dueDate: "2099-01-01",
  paidTotal: 0,
  pendingTotal: 50,
  grouped: true,
  ...over,
});

describe("handleTransactionTotalsEvent", () => {
  it("create de membro de grupo → set do resumo em transaction_groups", async () => {
    const member = baseMember({ installmentGroupId: "g1" });
    const fake = makeFakeFirestore([{ id: "tx1", data: member }]);
    const { event } = makeEvent(undefined, member, fake.firestore);

    await handleTransactionTotalsEvent(event as never);

    const summary = fake.groupSets.get("group_g1");
    expect(summary).toMatchObject({
      tenantId: "t1",
      groupKey: "group:g1",
      memberCount: 1,
      pendingTotal: 50,
    });
  });

  it("delete do último membro → delete do doc de grupo", async () => {
    const member = baseMember({ installmentGroupId: "g1" });
    const fake = makeFakeFirestore([]); // já não há membros
    const { event } = makeEvent(member, undefined, fake.firestore);

    await handleTransactionTotalsEvent(event as never);

    expect(fake.groupDeletes).toContain("group_g1");
    expect(fake.groupSets.size).toBe(0);
  });

  it("mudança de installmentGroupId → recompute dos DOIS grupos", async () => {
    const before = baseMember({ installmentGroupId: "g1" });
    const after = baseMember({ installmentGroupId: "g2" });
    const sibling = baseMember({ installmentGroupId: "g2", amount: 10, pendingTotal: 10 });
    const fake = makeFakeFirestore([
      { id: "tx1", data: after },
      { id: "tx9", data: sibling },
    ]);
    const { event } = makeEvent(before, after, fake.firestore);

    await handleTransactionTotalsEvent(event as never);

    expect(fake.groupDeletes).toContain("group_g1"); // g1 ficou vazio
    expect(fake.groupSets.get("group_g2")).toMatchObject({ memberCount: 2 });
  });

  it("avulso → grava grouped=false e não toca transaction_groups", async () => {
    const doc = baseMember({ grouped: undefined });
    delete doc.grouped;
    const fake = makeFakeFirestore([{ id: "tx1", data: doc }]);
    const { event, updateMock } = makeEvent(undefined, doc, fake.firestore);

    await handleTransactionTotalsEvent(event as never);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ grouped: false }),
    );
    expect(fake.transactionQueries()).toBe(0);
    expect(fake.groupSets.size).toBe(0);
    expect(fake.groupDeletes.length).toBe(0);
  });

  it("echo do próprio trigger (só totais mudaram) → sem recompute de grupo", async () => {
    const before = baseMember({ installmentGroupId: "g1", paidTotal: 999 });
    const after = baseMember({ installmentGroupId: "g1" });
    const fake = makeFakeFirestore([{ id: "tx1", data: after }]);
    const { event, updateMock } = makeEvent(before, after, fake.firestore);

    await handleTransactionTotalsEvent(event as never);

    expect(updateMock).not.toHaveBeenCalled(); // totais/grouped já corretos
    expect(fake.transactionQueries()).toBe(0);
    expect(fake.groupSets.size).toBe(0);
  });

  it("mudança de status de membro → totais atualizados no doc e resumo recomputado", async () => {
    const before = baseMember({ installmentGroupId: "g1" });
    const after = baseMember({
      installmentGroupId: "g1",
      status: "paid",
      // totais desatualizados (pré-trigger)
      paidTotal: 0,
      pendingTotal: 50,
    });
    const fake = makeFakeFirestore([{ id: "tx1", data: after }]);
    const { event, updateMock } = makeEvent(before, after, fake.firestore);

    await handleTransactionTotalsEvent(event as never);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ paidTotal: 50, pendingTotal: 0 }),
    );
    expect(fake.groupSets.get("group_g1")).toMatchObject({
      paidCount: 1,
      status: "paid",
    });
  });

  it("grupo legado misto: membro com proposalGroupId promove o grupo inteiro à chave proposal", async () => {
    const legacy = baseMember({ installmentGroupId: "g1" }); // sem proposalGroupId
    const promoted = baseMember({
      installmentGroupId: "g1",
      proposalGroupId: "p1",
    });
    const fake = makeFakeFirestore([
      { id: "tx1", data: legacy },
      { id: "tx2", data: promoted },
    ]);
    const { event } = makeEvent(undefined, legacy, fake.firestore);

    await handleTransactionTotalsEvent(event as never);

    expect(fake.groupDeletes).toContain("group_g1");
    expect(fake.groupSets.get("proposal_p1")).toMatchObject({
      groupKey: "proposal:p1",
      memberCount: 2, // inclui o irmão legado sem proposalGroupId
    });
  });
});

describe("coalescência e ordem dos resumos", () => {
  it("resumo calculado de uma leitura POSTERIOR à escrita: não relê o grupo", async () => {
    const member = baseMember({ installmentGroupId: "g1" });
    const fake = makeFakeFirestore([{ id: "tx1", data: member }]);
    // Outro evento já recalculou lendo no instante 50.
    fake.syncDocs.set("group_g1", { sourceReadTime: fake.tsOf(50) });
    const { event } = makeEvent(undefined, member, fake.firestore);
    (event.data.after as Record<string, unknown>).updateTime = fake.tsOf(40);

    await handleTransactionTotalsEvent(event as never);

    expect(fake.transactionQueries()).toBe(0);
    expect(fake.groupSets.size).toBe(0);
  });

  it("resumo calculado ANTES da escrita: recalcula e grava o readTime novo", async () => {
    const member = baseMember({ installmentGroupId: "g1" });
    const fake = makeFakeFirestore([{ id: "tx1", data: member }], { now: 100 });
    fake.syncDocs.set("group_g1", { sourceReadTime: fake.tsOf(30) });
    const { event } = makeEvent(undefined, member, fake.firestore);
    (event.data.after as Record<string, unknown>).updateTime = fake.tsOf(40);

    await handleTransactionTotalsEvent(event as never);

    expect(fake.groupSets.get("group_g1")).toMatchObject({ memberCount: 1 });
    // Duas consultas (parcela e recorrência, readTime 101 e 102): vale a
    // MENOR, porque o conjunto só é garantido completo até a mais antiga.
    expect(fake.syncDocs.get("group_g1")).toMatchObject({
      sourceReadTime: { seconds: 101, nanoseconds: 0 },
    });
  });

  it("mesmo segundo, nanos diferentes: leitura anterior à escrita não conta como coberta", async () => {
    const member = baseMember({ installmentGroupId: "g1" });
    const fake = makeFakeFirestore([{ id: "tx1", data: member }], { now: 200 });
    fake.syncDocs.set("group_g1", { sourceReadTime: { seconds: 40, nanoseconds: 100 } });
    const { event } = makeEvent(undefined, member, fake.firestore);
    (event.data.after as Record<string, unknown>).updateTime = { seconds: 40, nanoseconds: 200 };

    await handleTransactionTotalsEvent(event as never);

    expect(fake.transactionQueries()).toBeGreaterThan(0);
    expect(fake.groupSets.has("group_g1")).toBe(true);
  });

  it("recálculo baseado em leitura mais velha não sobrescreve um mais novo", async () => {
    const member = baseMember({ installmentGroupId: "g1" });
    const fake = makeFakeFirestore([{ id: "tx1", data: member }], { now: 10 });
    // Enquanto este evento lia (readTime ~11-12), outro gravou com leitura em 500.
    fake.syncDocs.set("group_g1", { sourceReadTime: fake.tsOf(500) });
    const { event } = makeEvent(undefined, member, fake.firestore);
    // Sem updateTime: não dá para pular pela checagem prévia; decide a transação.

    await handleTransactionTotalsEvent(event as never);

    expect(fake.groupSets.size).toBe(0);
    expect(fake.syncDocs.get("group_g1")).toMatchObject({ sourceReadTime: fake.tsOf(500) });
  });

  it("delete usa o instante do evento para decidir se já está coberto", async () => {
    const member = baseMember({ installmentGroupId: "g1" });
    const fake = makeFakeFirestore([]);
    fake.syncDocs.set("group_g1", { sourceReadTime: fake.tsOf(2_000_000_000) });
    const { event } = makeEvent(member, undefined, fake.firestore);
    (event as Record<string, unknown>).time = "2026-09-25T12:00:00.000Z";

    await handleTransactionTotalsEvent(event as never);

    expect(fake.transactionQueries()).toBe(0);
    expect(fake.groupDeletes).toEqual([]);
  });
});
