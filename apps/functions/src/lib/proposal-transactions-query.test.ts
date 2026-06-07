import type {
  CollectionReference,
} from "firebase-admin/firestore";
import {
  buildProposalTransactionsCleanupQuery,
  MAX_PROPOSAL_CLEANUP_TRANSACTIONS,
} from "./proposal-transactions-query";

function makeCollection() {
  const whereCalls: Array<[string, string, string]> = [];
  const limitCalls: number[] = [];

  const query: Record<string, unknown> = {
    where(field: string, op: string, value: string) {
      whereCalls.push([field, op, value]);
      return query;
    },
    limit(n: number) {
      limitCalls.push(n);
      return query;
    },
  };

  return { collection: query as unknown as CollectionReference, whereCalls, limitCalls };
}

describe("buildProposalTransactionsCleanupQuery", () => {
  it("scopes by BOTH proposalId and tenantId (not just proposalId)", () => {
    const { collection, whereCalls } = makeCollection();
    buildProposalTransactionsCleanupQuery(collection, "prop-1", "tenant-1");

    expect(whereCalls).toContainEqual(["proposalId", "==", "prop-1"]);
    expect(whereCalls).toContainEqual(["tenantId", "==", "tenant-1"]);
  });

  it("bounds the read with a limit (no unbounded .get())", () => {
    const { collection, limitCalls } = makeCollection();
    buildProposalTransactionsCleanupQuery(collection, "prop-1", "tenant-1");

    expect(limitCalls).toEqual([MAX_PROPOSAL_CLEANUP_TRANSACTIONS]);
    // cap stays within Firestore's 500-op transaction ceiling (~2 ops/doc)
    expect(MAX_PROPOSAL_CLEANUP_TRANSACTIONS).toBeLessThanOrEqual(250);
  });
});
