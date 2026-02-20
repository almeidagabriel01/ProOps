import { db } from "../../../init";
import { Timestamp } from "firebase-admin/firestore";
import { toDate, toNumber, normalizeTransactionType } from "./whatsapp.utils";
import { ProposalListItem, NormalizedTransaction } from "./whatsapp.types";

export async function queryProposalsForTenant(
  firestore: FirebaseFirestore.Firestore,
  tenantId: string,
  limitN = 10,
): Promise<ProposalListItem[]> {
  const proposalsRef = firestore.collection("proposals");

  const runQuery = async (
    field: "tenantId" | "companyId",
  ): Promise<{
    usedField: "tenantId" | "companyId";
    snap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
  } | null> => {
    try {
      const snap = await proposalsRef
        .where(field, "==", tenantId)
        .orderBy("updatedAt", "desc")
        .limit(limitN)
        .get();
      return { usedField: field, snap };
    } catch (error) {
      console.warn(`[WhatsApp] proposals query failed (${field})`, error);
      try {
        const fallbackSnap = await proposalsRef
          .where(field, "==", tenantId)
          .limit(limitN)
          .get();
        return { usedField: field, snap: fallbackSnap };
      } catch (fallbackError) {
        console.warn(
          `[WhatsApp] proposals query fallback failed (${field})`,
          fallbackError,
        );
        return null;
      }
    }
  };

  const tenantResult = await runQuery("tenantId");
  if (tenantResult && !tenantResult.snap.empty) {
    console.log("[WhatsApp] proposals found", {
      tenantId,
      count: tenantResult.snap.size,
      usedField: tenantResult.usedField,
    });
    return tenantResult.snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        title: String(data.title || "Proposta"),
        clientName: String(data.clientName || "").trim(),
        totalValue: toNumber(data.totalValue ?? data.total ?? data.value),
        updatedAt: toDate(data.updatedAt),
      };
    });
  }

  const companyResult = await runQuery("companyId");
  if (companyResult && !companyResult.snap.empty) {
    console.log("[WhatsApp] proposals found", {
      tenantId,
      count: companyResult.snap.size,
      usedField: companyResult.usedField,
    });
    return companyResult.snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        title: String(data.title || "Proposta"),
        clientName: String(data.clientName || "").trim(),
        totalValue: toNumber(data.totalValue ?? data.total ?? data.value),
        updatedAt: toDate(data.updatedAt),
      };
    });
  }

  console.log("[WhatsApp] proposals found", {
    tenantId,
    count: 0,
    usedField: "companyId",
  });
  return [];
}

export async function getProposalByIdForTenant(
  tenantId: string,
  proposalId: string,
): Promise<{ id: string; [key: string]: unknown } | null> {
  const trimmedId = String(proposalId || "").trim();
  if (!trimmedId) return null;

  const docRef = db.collection("proposals").doc(trimmedId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) return null;

  const data = docSnap.data() as any;
  if (!data) return null;
  if (data.tenantId !== tenantId && data.companyId !== tenantId) return null;

  return { id: docSnap.id, ...data };
}

export async function getTransactionsFromCollection(
  collectionName: "transactions" | "wallet_transactions",
  tenantId: string,
  start: Date,
  end: Date,
): Promise<NormalizedTransaction[]> {
  const startTs = Timestamp.fromDate(start);
  const endTs = Timestamp.fromDate(end);
  const collectionRef = db.collection(collectionName);

  let docs: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[] =
    [];

  try {
    const ranged = await collectionRef
      .where("tenantId", "==", tenantId)
      .where("createdAt", ">=", startTs)
      .where("createdAt", "<", endTs)
      .get();
    docs = ranged.docs;
  } catch (error) {
    console.warn(
      `[WhatsApp] Failed ${collectionName} range query, using fallback`,
      error,
    );
    try {
      const fallback = await collectionRef
        .where("tenantId", "==", tenantId)
        .get();
      docs = fallback.docs.filter((doc) => {
        const data = doc.data() as any;
        const createdAt = toDate(data.createdAt);
        const dateValue = toDate(data.date);
        const txDate = createdAt || dateValue;
        return !!txDate && txDate >= start && txDate < end;
      });
    } catch (fallbackError) {
      console.warn(
        `[WhatsApp] Failed ${collectionName} fallback query`,
        fallbackError,
      );
      return [];
    }
  }

  return docs.map((doc) => {
    const data = doc.data() as any;
    const rawAmount = toNumber(data.amount ?? data.value);
    const amountAbs = Math.abs(rawAmount);
    return {
      id: doc.id,
      type: normalizeTransactionType(data.type, rawAmount),
      amount: amountAbs,
    };
  });
}

export async function getTodaysTransactions(
  tenantId: string,
  start: Date,
  end: Date,
): Promise<NormalizedTransaction[]> {
  const fromTransactions = await getTransactionsFromCollection(
    "transactions",
    tenantId,
    start,
    end,
  );
  if (fromTransactions.length > 0) return fromTransactions;

  const fromWalletTransactions = await getTransactionsFromCollection(
    "wallet_transactions",
    tenantId,
    start,
    end,
  );
  if (fromWalletTransactions.length > 0) return fromWalletTransactions;

  return [];
}

export async function queryWalletsForTenant(
  firestore: FirebaseFirestore.Firestore,
  tenantId: string,
): Promise<{ totalBalance: number; count: number }> {
  const walletsRef = firestore.collection("wallets");

  const runQuery = async (field: "tenantId" | "companyId") => {
    try {
      return await walletsRef.where(field, "==", tenantId).get();
    } catch (error) {
      console.warn(`[WhatsApp] wallets query failed (${field})`, error);
      return null;
    }
  };

  const tenantSnap = await runQuery("tenantId");
  const companySnap =
    tenantSnap && !tenantSnap.empty ? null : await runQuery("companyId");
  const snap = tenantSnap && !tenantSnap.empty ? tenantSnap : companySnap;

  if (!snap || snap.empty) {
    console.log("[WhatsApp] wallets found", {
      tenantId,
      count: 0,
      totalBalance: 0,
    });
    return { totalBalance: 0, count: 0 };
  }

  const allDocs = snap.docs;
  const activeDocs = allDocs.filter((doc) => {
    const data = doc.data() as any;
    return !data.status || data.status === "active";
  });
  const docsToSum = activeDocs.length > 0 ? activeDocs : allDocs;

  const totalBalance = docsToSum.reduce((acc, doc) => {
    const data = doc.data() as any;
    return acc + toNumber(data.balance ?? data.amount);
  }, 0);

  console.log("[WhatsApp] wallets found", {
    tenantId,
    count: docsToSum.length,
    totalBalance,
  });

  return { totalBalance, count: docsToSum.length };
}

export async function getWalletSummary(
  tenantId: string,
): Promise<{ totalBalance: number }> {
  try {
    const result = await queryWalletsForTenant(db, tenantId);
    return { totalBalance: result.totalBalance };
  } catch (error) {
    console.error("[WhatsApp] Error fetching wallet summary:", error);
    return { totalBalance: 0 };
  }
}
