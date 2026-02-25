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
  const normalize = (
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
  ): NormalizedTransaction[] =>
    docs.map((doc) => {
      const data = doc.data() as any;
      const rawAmount = toNumber(data.amount ?? data.value);
      return {
        id: doc.id,
        type: normalizeTransactionType(data.type, rawAmount),
        amount: Math.abs(rawAmount),
      };
    });

  const dedup = (items: NormalizedTransaction[]): NormalizedTransaction[] => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  // Query both "created today" and "paid today" from a given collection
  const queryCollection = async (
    collectionName: "transactions" | "wallet_transactions",
  ): Promise<NormalizedTransaction[]> => {
    const startTs = Timestamp.fromDate(start);
    const endTs = Timestamp.fromDate(end);
    const ref = db.collection(collectionName);

    try {
      // First try: indexed query on createdAt (this index always exists)
      const createdSnap = await ref
        .where("tenantId", "==", tenantId)
        .where("createdAt", ">=", startTs)
        .where("createdAt", "<", endTs)
        .get();

      // Also try paidAt and updatedAt+status (composite indexes may not exist)
      let extraDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
      try {
        const paidSnap = await ref
          .where("tenantId", "==", tenantId)
          .where("paidAt", ">=", startTs)
          .where("paidAt", "<", endTs)
          .get();
        extraDocs.push(...paidSnap.docs);
      } catch {
        /* index may not exist */
      }

      try {
        const updatedPaidSnap = await ref
          .where("tenantId", "==", tenantId)
          .where("status", "==", "paid")
          .where("updatedAt", ">=", startTs)
          .where("updatedAt", "<", endTs)
          .get();
        extraDocs.push(...updatedPaidSnap.docs);
      } catch {
        /* index may not exist */
      }

      const allDocs = [...createdSnap.docs, ...extraDocs];
      if (allDocs.length > 0) {
        return dedup(normalize(allDocs));
      }

      // No indexed results — fall through to in-memory filter below
    } catch (error) {
      console.warn(`[WhatsApp] Failed ${collectionName} indexed query`, error);
    }

    // Fallback: fetch all tenant transactions and filter in-memory
    try {
      const fallback = await ref.where("tenantId", "==", tenantId).get();
      const filtered = fallback.docs.filter((doc) => {
        const data = doc.data() as any;
        const createdAt = toDate(data.createdAt);
        const paidAt = toDate(data.paidAt);
        const updatedAt = toDate(data.updatedAt);
        const dateValue = toDate(data.date);
        const txDate = createdAt || dateValue;
        const isCreatedToday = !!txDate && txDate >= start && txDate < end;
        const isPaidToday = !!paidAt && paidAt >= start && paidAt < end;
        const isUpdatedPaidToday =
          data.status === "paid" &&
          !!updatedAt &&
          updatedAt >= start &&
          updatedAt < end;
        return isCreatedToday || isPaidToday || isUpdatedPaidToday;
      });
      return normalize(filtered);
    } catch (fallbackError) {
      console.warn(
        `[WhatsApp] Failed ${collectionName} fallback query`,
        fallbackError,
      );
      return [];
    }
  };

  const fromTransactions = await queryCollection("transactions");
  if (fromTransactions.length > 0) return fromTransactions;

  const fromWalletTransactions = await queryCollection("wallet_transactions");
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
export async function getRecentTransactions(
  tenantId: string,
  limitN = 10,
): Promise<{ id: string; description: string; amount: number; date: Date }[]> {
  /** Strip installment prefixes/suffixes from a description. */
  const cleanDesc = (desc: string): string =>
    String(desc)
      .replace(/^(?:Parcela\s+\d+\/\d+:\s+|Entrada:\s+)/i, "")
      .replace(/\s*\(\d+\/\d+\)$/, "");

  /** Pick the representative entry and aggregate a list of group members. */
  const aggregateMembers = (
    members: { id: string; data: any }[],
  ): { id: string; description: string; amount: number; date: Date } => {
    let totalAmount = 0;
    let mainDesc = members[0].data.description || "Lançamento";
    let mainDate =
      toDate(members[0].data.date ?? members[0].data.createdAt) || new Date();
    let mainId = members[0].id;
    let foundDown = false;

    for (const m of members) {
      totalAmount += Math.abs(toNumber(m.data.amount ?? m.data.value));

      if (m.data.isDownPayment) {
        mainDesc = m.data.description || mainDesc;
        mainDate = toDate(m.data.date ?? m.data.createdAt) || mainDate;
        mainId = m.id;
        foundDown = true;
      } else if (
        (toNumber(m.data.installmentNumber) || -1) === 1 &&
        !foundDown
      ) {
        mainDesc = m.data.description || mainDesc;
        mainDate = toDate(m.data.date ?? m.data.createdAt) || mainDate;
        mainId = m.id;
      }
    }

    return {
      id: mainId,
      description: cleanDesc(mainDesc),
      amount: totalAmount,
      date: mainDate,
    };
  };

  /**
   * Core logic: takes a pre-fetched list of docs and groups them in-memory.
   * Zero additional Firestore queries.
   */
  const processInMemory = (
    allDocs: { id: string; data: any }[],
  ): { id: string; description: string; amount: number; date: Date }[] => {
    // Phase 1: Build explicit groups
    const proposalGroups = new Map<string, { id: string; data: any }[]>();
    const installmentGroups = new Map<string, { id: string; data: any }[]>();
    const orphanDownPayments: { id: string; data: any }[] = [];
    const standalone: { id: string; data: any }[] = [];

    for (const item of allDocs) {
      const d = item.data;
      if (d.proposalGroupId) {
        const key = d.proposalGroupId;
        if (!proposalGroups.has(key)) proposalGroups.set(key, []);
        proposalGroups.get(key)!.push(item);
      } else if (d.installmentGroupId) {
        const key = d.installmentGroupId;
        if (!installmentGroups.has(key)) installmentGroups.set(key, []);
        installmentGroups.get(key)!.push(item);
      } else if (d.isDownPayment) {
        orphanDownPayments.push(item);
      } else {
        standalone.push(item);
      }
    }

    // Phase 2: Match orphan down payments to installment groups by heuristic
    // (same type + date + description — mirrors useFinancialData.ts)
    for (const orphan of orphanDownPayments) {
      const oDesc = (orphan.data.description || "").trim();
      const oType = orphan.data.type;
      const oDate = orphan.data.date;
      let matched = false;

      for (const [key, members] of installmentGroups.entries()) {
        const sample = members[0].data;
        if (
          sample.type === oType &&
          sample.date === oDate &&
          cleanDesc(sample.description || "").trim() === oDesc
        ) {
          installmentGroups.get(key)!.push(orphan);
          matched = true;
          break;
        }
      }

      if (!matched) {
        standalone.push(orphan);
      }
    }

    // Phase 3: Build results in createdAt desc order (first-seen group wins)
    const results: {
      id: string;
      description: string;
      amount: number;
      date: Date;
    }[] = [];
    const processedGroups = new Set<string>();

    for (const item of allDocs) {
      if (results.length >= limitN) break;
      const d = item.data;

      // Proposal group
      if (d.proposalGroupId) {
        const key = `prop:${d.proposalGroupId}`;
        if (processedGroups.has(key)) continue;
        processedGroups.add(key);
        results.push(aggregateMembers(proposalGroups.get(d.proposalGroupId)!));
        continue;
      }

      // Installment group (also contains matched orphan down payments)
      if (d.installmentGroupId) {
        const key = `inst:${d.installmentGroupId}`;
        if (processedGroups.has(key)) continue;
        processedGroups.add(key);
        results.push(
          aggregateMembers(installmentGroups.get(d.installmentGroupId)!),
        );
        continue;
      }

      // Orphan down payment that was matched — skip (already in an installment group)
      if (d.isDownPayment) {
        // Check if this orphan was absorbed into any installment group
        let absorbed = false;
        for (const [gKey, members] of installmentGroups.entries()) {
          if (members.some((m) => m.id === item.id)) {
            const key = `inst:${gKey}`;
            if (!processedGroups.has(key)) {
              processedGroups.add(key);
              results.push(aggregateMembers(members));
            }
            absorbed = true;
            break;
          }
        }
        if (absorbed) continue;
      }

      // Standalone transaction
      const key = `doc:${item.id}`;
      if (processedGroups.has(key)) continue;
      processedGroups.add(key);
      results.push({
        id: item.id,
        description: String(d.description || "Lançamento"),
        amount: Math.abs(toNumber(d.amount ?? d.value)),
        date: toDate(d.date ?? d.createdAt) || new Date(),
      });
    }

    return results;
  };

  try {
    const snapshot = await db
      .collection("transactions")
      .where("tenantId", "==", tenantId)
      .orderBy("createdAt", "desc")
      .limit(limitN * 15)
      .get();

    return processInMemory(
      snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
    );
  } catch (error) {
    console.warn("[WhatsApp] Failed getRecentTransactions query", error);
    try {
      const fallbackSnap = await db
        .collection("transactions")
        .where("tenantId", "==", tenantId)
        .limit(limitN * 15)
        .get();

      const sorted = fallbackSnap.docs
        .map((doc) => ({ id: doc.id, data: doc.data() as any }))
        .sort((a, b) => {
          const aTime = toDate(a.data.createdAt ?? a.data.date)?.getTime() || 0;
          const bTime = toDate(b.data.createdAt ?? b.data.date)?.getTime() || 0;
          return bTime - aTime;
        });

      return processInMemory(sorted);
    } catch (fallbackError) {
      console.error(
        "[WhatsApp] Failed getRecentTransactions fallback",
        fallbackError,
      );
      return [];
    }
  }
}

export async function getWeeklyPendingTransactions(
  tenantId: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<{ type: "income" | "expense"; amount: number }[]> {
  try {
    const snapshot = await db
      .collection("transactions")
      .where("tenantId", "==", tenantId)
      .where("status", "in", ["pending", "overdue"])
      .get();

    return snapshot.docs
      .filter((doc) => {
        const data = doc.data() as any;
        const dueDate = toDate(data.dueDate);
        return dueDate && dueDate >= weekStart && dueDate <= weekEnd;
      })
      .map((doc) => {
        const data = doc.data() as any;
        const rawAmount = toNumber(data.amount ?? data.value);
        return {
          type: normalizeTransactionType(data.type, rawAmount),
          amount: Math.abs(rawAmount),
        };
      });
  } catch (error) {
    console.error(
      "[WhatsApp] Failed getWeeklyPendingTransactions query",
      error,
    );
    return [];
  }
}
