import { getFirestore } from "firebase-admin/firestore";
import { logger } from "../../lib/logger";

const TRANSACTIONS_COLLECTION = "transactions";
const PROPOSALS_COLLECTION = "proposals";
const BATCH_SIZE = 400;

export interface CascadeWalletRenameArgs {
  tenantId: string;
  walletId: string;
  oldName: string;
}

export interface CascadeWalletRenameResult {
  transactionsUpdated: number;
  proposalsUpdated: number;
}

/**
 * Updates every transaction and proposal that referenced the wallet by its
 * old NAME so they now reference it by walletId. Idempotent and tenant
 * scoped — never touches docs from another tenant. Runs synchronously in
 * chunks of 400 (Firestore batch limit). For tenants with > a few thousand
 * stale docs the request may take seconds; the operator-facing cost is a
 * single toast with the affected counts.
 *
 * Why update to walletId (instead of newName): the migration started in
 * April/2025 to store wallet by id. Cascading on rename is the natural
 * moment to retroactively flip legacy NAME-storage docs to id-storage,
 * which makes the next rename a no-op for those docs.
 */
export async function cascadeWalletRename(
  args: CascadeWalletRenameArgs,
): Promise<CascadeWalletRenameResult> {
  const { tenantId, walletId, oldName } = args;
  if (!tenantId || !walletId || !oldName) {
    return { transactionsUpdated: 0, proposalsUpdated: 0 };
  }

  const db = getFirestore();
  const nowIso = new Date().toISOString();

  const transactionsUpdated = await cascadeField({
    db,
    tenantId,
    nowIso,
    collection: TRANSACTIONS_COLLECTION,
    field: "wallet",
    oldValue: oldName,
    newValue: walletId,
  });

  const proposalsDown = await cascadeField({
    db,
    tenantId,
    nowIso,
    collection: PROPOSALS_COLLECTION,
    field: "downPaymentWallet",
    oldValue: oldName,
    newValue: walletId,
  });

  const proposalsInst = await cascadeField({
    db,
    tenantId,
    nowIso,
    collection: PROPOSALS_COLLECTION,
    field: "installmentsWallet",
    oldValue: oldName,
    newValue: walletId,
  });

  const result: CascadeWalletRenameResult = {
    transactionsUpdated,
    proposalsUpdated: proposalsDown + proposalsInst,
  };

  logger.info("Wallet rename cascade complete", {
    tenantId,
    walletId,
    oldName,
    ...result,
  });

  return result;
}

interface CascadeFieldArgs {
  db: FirebaseFirestore.Firestore;
  tenantId: string;
  nowIso: string;
  collection: string;
  field: string;
  oldValue: string;
  newValue: string;
}

async function cascadeField(args: CascadeFieldArgs): Promise<number> {
  const { db, tenantId, nowIso, collection, field, oldValue, newValue } = args;
  let total = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let query = db
      .collection(collection)
      .where("tenantId", "==", tenantId)
      .where(field, "==", oldValue)
      .limit(BATCH_SIZE);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, { [field]: newValue, updatedAt: nowIso });
    });
    await batch.commit();

    total += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  return total;
}
