import type {
  CollectionReference,
  Query,
} from "firebase-admin/firestore";

/**
 * Builds the query used to clean up a proposal's transactions. Filters by BOTH
 * proposalId and tenantId (tenant scoping / defense-in-depth) and bounds the
 * read with a limit — the previous query filtered only by proposalId with no
 * limit (unbounded read).
 *
 * The cap is aligned with the cleanup's runTransaction, which performs up to ~2
 * writes per doc (wallet balance reversal + delete); Firestore caps a
 * transaction at 500 operations, so beyond this many docs the cleanup could not
 * complete in a single transaction anyway.
 */
export const MAX_PROPOSAL_CLEANUP_TRANSACTIONS = 250;

export function buildProposalTransactionsCleanupQuery(
  collection: CollectionReference,
  proposalId: string,
  tenantId: string,
): Query {
  return collection
    .where("proposalId", "==", proposalId)
    .where("tenantId", "==", tenantId)
    .limit(MAX_PROPOSAL_CLEANUP_TRANSACTIONS);
}
