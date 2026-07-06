/**
 * handleTransactionTotalsEvent: mantém totais/grouped no próprio doc e os
 * resumos em transaction_groups. Fake Firestore em memória — sem emulador.
 */

import { handleTransactionTotalsEvent } from "./onTransactionTotals";

type FakeDoc = { id: string; data: Record<string, unknown> };

function makeFakeFirestore(members: FakeDoc[]) {
  const groupSets = new Map<string, Record<string, unknown>>();
  const groupDeletes: string[] = [];
  let transactionQueries = 0;

  const makeQuery = (filters: Array<[string, unknown]>) => ({
    where(field: string, _op: string, value: unknown) {
      return makeQuery([...filters, [field, value]]);
    },
    limit() {
      return this;
    },
    async get() {
      transactionQueries += 1;
      const docs = members
        .filter((d) => filters.every(([f, v]) => d.data[f] === v))
        .map((d) => ({ id: d.id, data: () => d.data }));
      return { docs, empty: docs.length === 0 };
    },
  });

  const firestore = {
    collection(name: string) {
      if (name === "transactions") return makeQuery([]);
      if (name === "transaction_groups") {
        return {
          doc(id: string) {
            return {
              async set(data: Record<string, unknown>) {
                groupSets.set(id, data);
              },
              async delete() {
                groupDeletes.push(id);
              },
            };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
  };

  return {
    firestore,
    groupSets,
    groupDeletes,
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
