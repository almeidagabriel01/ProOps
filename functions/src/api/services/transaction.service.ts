import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  checkFinancialPermission,
  resolveWalletRef,
  addMonths,
} from "../../lib/finance-helpers";
import { CreateTransactionDTO } from "../helpers/transaction-validation";
import { logger } from "../../lib/logger";

const COLLECTION_NAME = "transactions";

interface UpdateFinancialEntryWithInstallmentsDTO {
  description?: string;
  type?: "income" | "expense";
  category?: string;
  clientId?: string | null;
  clientName?: string | null;
  notes?: string | null;
  status?: "paid" | "pending" | "overdue";
  amount?: string | number;
  date?: string;
  dueDate?: string;
  isInstallment?: boolean;
  installmentCount?: number;
  paymentMode?: "total" | "installmentValue";
  installmentValue?: string | number;
  firstInstallmentDate?: string;
  wallet?: string | null;
  installmentsWallet?: string | null;
  downPaymentEnabled?: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: string | number;
  downPaymentValue?: string | number;
  downPaymentWallet?: string | null;
  downPaymentDueDate?: string;
  expectedUpdatedAt?: string | number;
  targetTenantId?: string;
  extraTransactionIds?: string[];
  installmentInterval?: number;
  isRecurring?: boolean;
  recurringGroupId?: string;
}

type TransactionDoc = {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  data: Record<string, any>;
};

const UPDATABLE_TRANSACTION_FIELDS = new Set([
  "type",
  "description",
  "amount",
  "date",
  "dueDate",
  "status",
  "clientId",
  "clientName",
  "proposalId",
  "proposalGroupId",
  "category",
  "wallet",
  "isDownPayment",
  "downPaymentType",
  "downPaymentPercentage",
  "isInstallment",
  "installmentCount",
  "installmentNumber",
  "installmentGroupId",
  "installmentInterval",
  "isRecurring",
  "recurringGroupId",
  "paymentMode",
  "notes",
  "extraCosts",
  "isPartialPayment",
  "parentTransactionId",
]);

function sanitizeTransactionUpdateData(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (UPDATABLE_TRANSACTION_FIELDS.has(key) && value !== undefined) {
      safe[key] = value;
    }
  });
  return safe;
}

function roundCurrency(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function toNumber(value: unknown, fallback = 0): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseFloat(value)
        : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function toDateOnly(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.includes("T") ? value.split("T")[0] : value;
  }
  return fallback;
}

function timestampToMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const asObj = value as {
    toMillis?: () => number;
    seconds?: number;
    nanoseconds?: number;
    _seconds?: number;
    _nanoseconds?: number;
  };
  if (typeof asObj?.toMillis === "function") {
    return asObj.toMillis();
  }
  const sec =
    typeof asObj?.seconds === "number"
      ? asObj.seconds
      : typeof asObj?._seconds === "number"
        ? asObj._seconds
        : undefined;
  const nanos =
    typeof asObj?.nanoseconds === "number"
      ? asObj.nanoseconds
      : typeof asObj?._nanoseconds === "number"
        ? asObj._nanoseconds
        : 0;
  if (typeof sec === "number") {
    return sec * 1000 + Math.floor(nanos / 1_000_000);
  }
  return 0;
}

function getWalletImpacts(data: Record<string, any>): Map<string, number> {
  const impacts = new Map<string, number>();
  if (!data) return impacts;

  const type = data.type; // "income" or "expense"
  const sign = type === "income" ? 1 : -1;

  const addImpact = (wallet: string | null | undefined, amount: number) => {
    if (!wallet || amount === 0) return;
    impacts.set(wallet, (impacts.get(wallet) || 0) + amount);
  };

  // Main transaction impact
  if (data.status === "paid" && data.wallet) {
    addImpact(data.wallet, sign * (toNumber(data.amount, 0) || 0));
  }

  // Extra Costs impact (add to parent transaction value)
  if (data.extraCosts && Array.isArray(data.extraCosts)) {
    for (const ec of data.extraCosts) {
      if (ec.status === "paid" && (ec.wallet || data.wallet)) {
        addImpact(
          ec.wallet || data.wallet,
          sign * (toNumber(ec.amount, 0) || 0),
        );
      }
    }
  }

  return impacts;
}

function syncExtraCostsStatus(
  extraCosts: unknown,
  newStatus: "paid" | "pending" | "overdue",
  oldParentStatus?: string,
): Record<string, any>[] | undefined {
  if (!Array.isArray(extraCosts)) return undefined;

  return extraCosts.map((ec) => {
    const ecData = ec as Record<string, any>;
    // Only sync extra costs that were aligned with the old parent status
    // (or had no status set). Leave independently-set statuses untouched.
    if (oldParentStatus && ecData.status && ecData.status !== oldParentStatus) {
      return ecData;
    }
    return { ...ecData, status: newStatus };
  });
}

function isDownPaymentLikeDoc(data: Record<string, any>): boolean {
  return !!data?.isDownPayment || toNumber(data?.installmentNumber, -1) === 0;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

type DbOp = { type: "set"; ref: FirebaseFirestore.DocumentReference; data: any } | { type: "delete"; ref: FirebaseFirestore.DocumentReference };

/**
 * Handles reading the next recurrence to determine if it should be generated/destroyed.
 * Returns the write operations to avoid Firestore "read after write" errors.
 */
async function getNextRecurringTransactionOps(
  t: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  txTenantId: string,
  now: Timestamp,
  userId: string,
  currentData: any,
  nextStatus: "paid" | "pending" | "overdue"
): Promise<DbOp[]> {
  if (!currentData.isRecurring || !currentData.recurringGroupId) return [];

  const currentNumber = toNumber(currentData.installmentNumber, 1);
  const nextNumber = currentNumber + 1;
  const groupId = currentData.recurringGroupId;

  const nextQuery = db
    .collection("transactions")
    .where("tenantId", "==", txTenantId)
    .where("recurringGroupId", "==", groupId)
    .where("installmentNumber", "==", nextNumber)
    .limit(1);

  const nextSnap = await t.get(nextQuery);

  if (nextStatus === "paid" && nextSnap.empty) {
    // Generate next recurrence
    const interval = currentData.installmentInterval || 1;
    const nextDueDate = addMonths(currentData.dueDate || currentData.date, interval);
    
    const nextTx = {
      tenantId: txTenantId,
      type: currentData.type,
      description: currentData.description, // Kept stable without counter for recurrences
      amount: currentData.amount,
      date: currentData.date, // Launch date is constant
      dueDate: nextDueDate,
      status: "pending",
      clientId: currentData.clientId || null,
      clientName: currentData.clientName || null,
      proposalId: currentData.proposalId || null,
      category: currentData.category || null,
      wallet: currentData.installmentsWallet || currentData.wallet || null,
      isInstallment: false,
      isRecurring: true,
      downPaymentType: null,
      downPaymentPercentage: null,
      // Pass the count down in case we want to retain whatever the base was, but strictly 1 by 1 UI
      installmentCount: currentData.installmentCount,
      installmentNumber: nextNumber,
      installmentGroupId: null,
      recurringGroupId: groupId,
      installmentInterval: interval,
      paymentMode: currentData.paymentMode || null,
      notes: currentData.notes || null,
      extraCosts: [], // Don't forward manual extra costs automatically
      createdAt: now,
      updatedAt: now,
      createdById: userId,
    };

    const ref = db.collection("transactions").doc();
    return [{ type: "set", ref, data: nextTx }];
  } else if (nextStatus !== "paid" && !nextSnap.empty) {
    // Revered payment -> Delete the automatically generated future one IF it is still pending
    const nextDoc = nextSnap.docs[0];
    const nextData = nextDoc.data();
    if (nextData.status === "pending" || nextData.status === "overdue") {
       return [{ type: "delete", ref: nextDoc.ref }];
    }
  }
  return [];
}


export class TransactionService {
  /**
   * Creates a transaction or multiple installments.
   * Handles wallet adjustments for paid transactions.
   */
  static async createTransaction(
    userId: string,
    user: any, // Decoded ID Token
    data: CreateTransactionDTO,
  ) {
    const { tenantId: userTenantId, isSuperAdmin } =
      await checkFinancialPermission(userId, "canCreate", user);

    // Super admin can specify target tenant
    const tenantId =
      data.targetTenantId && isSuperAdmin ? data.targetTenantId : userTenantId;

    // Prepare data
    const now = Timestamp.now();

    return await db.runTransaction(async (t) => {
      const transactionsToCreate: Record<string, unknown>[] = [];
      const walletAdjustments = new Map<string, number>();

      const generatedGroupId = `gen_${now.toMillis()}`;
      const groupId = data.installmentGroupId || data.recurringGroupId || generatedGroupId;

      const shouldGenerateInstallments =
        data.isInstallment &&
        (data.installmentCount || 0) > 1 &&
        (!data.installmentNumber || data.installmentNumber === 1);

      const shouldGenerateRecurrences =
        data.isRecurring &&
        (data.installmentCount || 0) > 1 &&
        (!data.installmentNumber || data.installmentNumber === 1);

      if (shouldGenerateInstallments || shouldGenerateRecurrences) {
        const count = data.installmentCount!;
        const baseAmount = data.amount;

        for (let i = 0; i < count; i++) {
          const isFirst = i === 0;
          const currentStatus = isFirst ? data.status : "pending";

          // Date (launch date) stays the same for all installments
          const currentDate = data.date;

          // DueDate (vencimento) increments by month for each installment
          // If no dueDate provided, use date as base
          const baseDueDate = data.dueDate || data.date;
          const interval = data.installmentInterval || 1;
          const currentDueDate = addMonths(baseDueDate, i * interval);

          const newTx = {
            tenantId,
            type: data.type,
            description: isFirst
              ? data.description
              : `${data.description} (${i + 1}/${count})`,
            amount: baseAmount,
            date: currentDate,
            dueDate: currentDueDate,
            status: currentStatus,
            clientId: data.clientId || null,
            clientName: data.clientName || null,
            proposalId: data.proposalId || null,
            category: data.category || null,
            wallet: data.wallet || null,
            isDownPayment: false,
            isInstallment: !!data.isInstallment,
            isRecurring: !!data.isRecurring,
            downPaymentType: data.downPaymentType || null,
            downPaymentPercentage: data.downPaymentPercentage || null,
            installmentCount: count,
            installmentNumber: i + 1,
            installmentGroupId: data.isInstallment ? groupId : null,
            recurringGroupId: data.isRecurring ? groupId : null,
            installmentInterval: data.installmentInterval || 1,
            paymentMode: data.paymentMode || null,
            notes: data.notes || null,
            extraCosts: data.extraCosts || [],
            createdAt: now,
            updatedAt: now,
            createdById: userId,
          };

          transactionsToCreate.push(newTx);

          const impacts = getWalletImpacts(newTx);
          for (const [wallet, adj] of impacts.entries()) {
            walletAdjustments.set(
              wallet,
              (walletAdjustments.get(wallet) || 0) + adj,
            );
          }
        }
      } else {
        const newTx = {
          tenantId,
          type: data.type,
          description: data.description.trim(),
          amount: data.amount,
          date: data.date,
          dueDate: data.dueDate || null,
          status: data.status,
          clientId: data.clientId || null,
          clientName: data.clientName || null,
          proposalId: data.proposalId || null,
          category: data.category || null,
          wallet: data.wallet || null,
          isDownPayment: !!data.isDownPayment,
          downPaymentType: data.downPaymentType || null,
          downPaymentPercentage: data.downPaymentPercentage || null,
          isInstallment: !!data.isInstallment,
          isRecurring: !!data.isRecurring,
          installmentCount: data.installmentCount || null,
          installmentNumber: data.isRecurring ? (data.installmentNumber || 1) : (data.installmentNumber || null),
          installmentGroupId: data.isInstallment ? groupId : (data.installmentGroupId || null),
          recurringGroupId: data.isRecurring ? groupId : (data.recurringGroupId || null),
          installmentInterval: data.installmentInterval || null,
          paymentMode: data.paymentMode || null,
          notes: data.notes || null,
          extraCosts: data.extraCosts || [],
          createdAt: now,
          updatedAt: now,
          createdById: userId,
        };

        transactionsToCreate.push(newTx);

        const impacts = getWalletImpacts(newTx);
        for (const [wallet, adj] of impacts.entries()) {
          walletAdjustments.set(
            wallet,
            (walletAdjustments.get(wallet) || 0) + adj,
          );
        }
      }

      // If a down payment is bundled, add it to the same atomic batch
      if (data.downPayment) {
        const dp = data.downPayment;
        const dpTx = {
          tenantId,
          type: data.type,
          description: data.description.trim(),
          amount: dp.amount,
          date: dp.date,
          dueDate: dp.dueDate || null,
          status: dp.status,
          clientId: data.clientId || null,
          clientName: data.clientName || null,
          proposalId: data.proposalId || null,
          category: data.category || null,
          wallet: dp.wallet || null,
          isDownPayment: true,
          isInstallment: false,
          isRecurring: false,
          downPaymentType: dp.downPaymentType || null,
          downPaymentPercentage: dp.downPaymentPercentage || null,
          installmentCount: dp.installmentCount || null,
          installmentNumber: dp.installmentNumber ?? 0,
          installmentGroupId: groupId,
          installmentInterval: data.installmentInterval || null,
          paymentMode: dp.paymentMode || null,
          notes: dp.notes || null,
          extraCosts: [],
          createdAt: now,
          updatedAt: now,
          createdById: userId,
        };

        transactionsToCreate.push(dpTx);

        const dpImpacts = getWalletImpacts(dpTx);
        for (const [wallet, adj] of dpImpacts.entries()) {
          walletAdjustments.set(wallet, (walletAdjustments.get(wallet) || 0) + adj);
        }
      }

      // Update Wallets
      for (const [
        walletIdentifier,
        adjustment,
      ] of walletAdjustments.entries()) {
        if (adjustment === 0) continue;
        const walletInfo = await resolveWalletRef(
          t,
          db,
          tenantId,
          walletIdentifier,
        );
        if (!walletInfo) {
          logger.error("Wallet not found during transaction creation", { tenantId, wallet: walletIdentifier, adjustment });
          throw new Error(`Carteira "${walletIdentifier}" não encontrada. Operação cancelada.`);
        }
        t.update(walletInfo.ref, {
          balance: FieldValue.increment(adjustment),
          updatedAt: now,
        });
      }

      // Write Transactions
      const createdIds: string[] = [];
      const collectionRef = db.collection(COLLECTION_NAME);

      for (const txData of transactionsToCreate) {
        const ref = collectionRef.doc();
        createdIds.push(ref.id);
        t.set(ref, txData);
      }

      return {
        transactionId: createdIds[0],
        count: transactionsToCreate.length,
      };
    });
  }

  /**
   * Updates a financial entry with installments/down payment as a single source of truth.
   * Everything is recalculated and persisted atomically in one Firestore transaction.
   */
  static async updateFinancialEntryWithInstallments(
    userId: string,
    user: any,
    id: string,
    payload: UpdateFinancialEntryWithInstallmentsDTO,
  ) {
    const { tenantId: userTenantId, isSuperAdmin } =
      await checkFinancialPermission(userId, "canEdit", user);

    await db.runTransaction(async (t) => {
      const now = Timestamp.now();
      const anchorRef = db.collection(COLLECTION_NAME).doc(id);
      const anchorSnap = await t.get(anchorRef);

      if (!anchorSnap.exists) throw new Error("Transação não encontrada.");
      const anchorData = anchorSnap.data() as Record<string, any>;
      if (!anchorData) throw new Error("Dados da transação inválidos.");

      const txTenantId = anchorData.tenantId as string;
      if (!txTenantId) throw new Error("Transação sem tenantId.");
      if (!isSuperAdmin && txTenantId !== userTenantId)
        throw new Error("Acesso negado.");
      if (payload.targetTenantId && payload.targetTenantId !== txTenantId) {
        throw new Error("Tenant alvo não corresponde à transação.");
      }

      const expectedUpdatedAtMillis = timestampToMillis(
        payload.expectedUpdatedAt,
      );
      if (expectedUpdatedAtMillis > 0) {
        const currentUpdatedAtMillis = timestampToMillis(anchorData.updatedAt);
        if (
          currentUpdatedAtMillis > 0 &&
          currentUpdatedAtMillis > expectedUpdatedAtMillis + 1
        ) {
          throw new Error(
            "Conflito de atualização. Recarregue os dados e tente novamente.",
          );
        }
      }

      let effectiveGroupId =
        (anchorData.installmentGroupId as string | null) || null;

      const wantInstallments = payload.isInstallment !== false;
      const requestedInstallmentCount = Math.max(
        1,
        Math.floor(
          toNumber(
            payload.installmentCount,
            toNumber(anchorData.installmentCount, 1),
          ),
        ),
      );
      const targetInstallmentCount = wantInstallments
        ? requestedInstallmentCount
        : 1;

      const downPaymentEnabled = !!payload.downPaymentEnabled;
      const paymentMode =
        payload.paymentMode === "installmentValue"
          ? "installmentValue"
          : "total";
      const installmentValue = roundCurrency(
        toNumber(payload.installmentValue, toNumber(anchorData.amount, 0)),
      );
      const totalAmount = roundCurrency(
        toNumber(payload.amount, toNumber(anchorData.amount, 0)),
      );

      const downPaymentType =
        payload.downPaymentType === "percentage" ? "percentage" : "value";
      const downPaymentAmountRaw =
        downPaymentType === "percentage"
          ? (paymentMode === "installmentValue"
              ? installmentValue * targetInstallmentCount
              : totalAmount) *
            (toNumber(payload.downPaymentPercentage, 0) / 100)
          : toNumber(payload.downPaymentValue, 0);
      const downPaymentAmount = roundCurrency(
        Math.max(0, downPaymentAmountRaw),
      );
      const shouldHaveDownPayment =
        wantInstallments && downPaymentEnabled && downPaymentAmount > 0;

      // If converting single transaction to grouped structure, create a stable group id.
      if (
        !effectiveGroupId &&
        (targetInstallmentCount > 1 || shouldHaveDownPayment)
      ) {
        effectiveGroupId = `installment_${now.toMillis()}`;
      }

      const allDocs: TransactionDoc[] = [];
      const pushedIds = new Set<string>();
      const pushDoc = (doc: TransactionDoc) => {
        if (pushedIds.has(doc.id)) return;
        pushedIds.add(doc.id);
        allDocs.push(doc);
      };

      const extraIds = Array.from(
        new Set((payload.extraTransactionIds || []).filter(Boolean)),
      );
      for (const extraId of extraIds) {
        const extraRef = db.collection(COLLECTION_NAME).doc(extraId);
        const extraSnap = await t.get(extraRef);
        if (!extraSnap.exists) continue;
        const extraData = extraSnap.data() as Record<string, any>;
        if (!extraData) continue;
        if (extraData.tenantId !== txTenantId) continue;
        pushDoc({ id: extraSnap.id, ref: extraRef, data: extraData });
      }

      if (effectiveGroupId) {
        const groupQuery = db
          .collection(COLLECTION_NAME)
          .where("tenantId", "==", txTenantId)
          .where("installmentGroupId", "==", effectiveGroupId);
        const groupSnap = await t.get(groupQuery);
        groupSnap.docs.forEach((docSnap) => {
          pushDoc({
            id: docSnap.id,
            ref: docSnap.ref,
            data: docSnap.data() as Record<string, any>,
          });
        });
      } else {
        pushDoc({ id: anchorSnap.id, ref: anchorRef, data: anchorData });
      }

      if (!allDocs.find((doc) => doc.id === id)) {
        pushDoc({ id: anchorSnap.id, ref: anchorRef, data: anchorData });
      }

      const downPaymentCandidates = allDocs
        .filter((doc) => isDownPaymentLikeDoc(doc.data))
        .sort((a, b) => {
          const aUpdated = timestampToMillis(a.data.updatedAt);
          const bUpdated = timestampToMillis(b.data.updatedAt);
          if (aUpdated !== bUpdated) return bUpdated - aUpdated;
          return (
            timestampToMillis(b.data.createdAt) -
            timestampToMillis(a.data.createdAt)
          );
        });
      const existingDownPayment = downPaymentCandidates[0] || null;
      const extraDownPayments = downPaymentCandidates.slice(1);

      const existingInstallments = allDocs
        .filter((doc) => !isDownPaymentLikeDoc(doc.data))
        .sort((a, b) => {
          const numberDiff =
            toNumber(a.data.installmentNumber, Number.MAX_SAFE_INTEGER) -
            toNumber(b.data.installmentNumber, Number.MAX_SAFE_INTEGER);
          if (numberDiff !== 0) return numberDiff;
          return (
            timestampToMillis(a.data.createdAt) -
            timestampToMillis(b.data.createdAt)
          );
        });

      const firstInstallment = existingInstallments[0]?.data || anchorData;
      const launchDate = toDateOnly(
        payload.date,
        toDateOnly(anchorData.date, now.toDate().toISOString().split("T")[0]),
      );
      const baseInstallmentDueDate = toDateOnly(
        paymentMode === "installmentValue"
          ? payload.firstInstallmentDate
          : payload.dueDate,
        toDateOnly(
          firstInstallment?.dueDate || firstInstallment?.date,
          launchDate,
        ),
      );
      const downPaymentDueDate = toDateOnly(
        payload.downPaymentDueDate,
        toDateOnly(
          existingDownPayment?.data?.dueDate || launchDate,
          launchDate,
        ),
      );

      const installmentsWalletInput =
        paymentMode === "installmentValue"
          ? (normalizeOptionalString(payload.installmentsWallet) ??
            normalizeOptionalString(payload.wallet))
          : (normalizeOptionalString(payload.wallet) ??
            normalizeOptionalString(payload.installmentsWallet));

      const installmentsWallet =
        installmentsWalletInput ??
        normalizeOptionalString(firstInstallment?.wallet) ??
        null;
      const downPaymentWallet =
        normalizeOptionalString(payload.downPaymentWallet) ??
        normalizeOptionalString(existingDownPayment?.data?.wallet) ??
        installmentsWallet ??
        null;

      const description = (payload.description ?? anchorData.description ?? "")
        .toString()
        .trim();
      const type = (payload.type ?? anchorData.type) as "income" | "expense";
      const category = payload.category ?? anchorData.category ?? null;
      const clientId = payload.clientId ?? anchorData.clientId ?? null;
      const clientName = payload.clientName ?? anchorData.clientName ?? null;
      const notes = payload.notes ?? anchorData.notes ?? null;
      const proposalId = anchorData.proposalId || null;
      const proposalGroupId = anchorData.proposalGroupId || null;

      const installmentAmounts: number[] = [];
      if (paymentMode === "installmentValue") {
        for (let i = 0; i < targetInstallmentCount; i++) {
          installmentAmounts.push(installmentValue);
        }
      } else {
        const remaining = roundCurrency(
          Math.max(
            0,
            totalAmount - (shouldHaveDownPayment ? downPaymentAmount : 0),
          ),
        );
        const equalInstallmentAmount = roundCurrency(
          remaining / targetInstallmentCount,
        );
        for (let i = 0; i < targetInstallmentCount; i++) {
          installmentAmounts.push(equalInstallmentAmount);
        }
      }

      const toCreate: Array<Record<string, any>> = [];
      const toUpdate: Array<{
        doc: TransactionDoc;
        next: Record<string, any>;
      }> = [];
      const toDelete: TransactionDoc[] = [...extraDownPayments];

      for (let i = 0; i < targetInstallmentCount; i++) {
        const existing = existingInstallments[i] || null;
        const interval = payload.installmentInterval || 1;
        
        const nextInstallment = {
          tenantId: txTenantId,
          type,
          description,
          amount: installmentAmounts[i] ?? 0,
          date: launchDate,
          dueDate: addMonths(baseInstallmentDueDate, i * interval),
          status:
            existing?.data?.status ||
            (i === 0
              ? payload.status || anchorData.status || "pending"
              : "pending"),
          clientId,
          clientName,
          proposalId,
          proposalGroupId,
          category,
          wallet: installmentsWallet,
          isDownPayment: false,
          downPaymentType: null,
          downPaymentPercentage: null,
          isInstallment: wantInstallments,
          installmentCount: targetInstallmentCount,
          installmentNumber: i + 1,
          installmentGroupId: effectiveGroupId,
          installmentInterval: payload.installmentInterval || 1,
          paymentMode: paymentMode,
          notes,
          updatedAt: now,
        };

        if (existing) {
          toUpdate.push({
            doc: existing,
            next: nextInstallment,
          });
        } else {
          toCreate.push({
            ...nextInstallment,
            createdAt: now,
            createdById: userId,
          });
        }
      }

      if (existingInstallments.length > targetInstallmentCount) {
        toDelete.push(...existingInstallments.slice(targetInstallmentCount));
      }

      if (shouldHaveDownPayment) {
        const nextDownPayment = {
          tenantId: txTenantId,
          type,
          description,
          amount: downPaymentAmount,
          date: launchDate,
          dueDate: downPaymentDueDate,
          status:
            existingDownPayment?.data?.status ||
            payload.status ||
            anchorData.status ||
            "pending",
          clientId,
          clientName,
          proposalId,
          proposalGroupId,
          category,
          wallet: downPaymentWallet,
          isDownPayment: true,
          downPaymentType,
          downPaymentPercentage:
            downPaymentType === "percentage"
              ? toNumber(payload.downPaymentPercentage, 0)
              : null,
          isInstallment: false,
          installmentCount: targetInstallmentCount,
          installmentNumber: 0,
          installmentGroupId: effectiveGroupId,
          installmentInterval: payload.installmentInterval || 1,
          paymentMode: paymentMode,
          notes,
          updatedAt: now,
        };

        if (existingDownPayment) {
          toUpdate.push({ doc: existingDownPayment, next: nextDownPayment });
        } else {
          toCreate.push({
            ...nextDownPayment,
            createdAt: now,
            createdById: userId,
          });
        }
      } else if (existingDownPayment) {
        toDelete.push(existingDownPayment);
      }

      const walletAdjustments = new Map<string, number>();
      const addWalletAdjustment = (
        wallet: string | null | undefined,
        delta: number,
      ) => {
        if (!wallet || delta === 0) return;
        walletAdjustments.set(
          wallet,
          (walletAdjustments.get(wallet) || 0) + delta,
        );
      };

      for (const op of toUpdate) {
        const oldImpacts = getWalletImpacts(op.doc.data);
        const newImpacts = getWalletImpacts(op.next);

        for (const [wallet, impact] of oldImpacts.entries()) {
          addWalletAdjustment(wallet, -impact);
        }
        for (const [wallet, impact] of newImpacts.entries()) {
          addWalletAdjustment(wallet, impact);
        }
      }
      for (const op of toCreate) {
        const newImpacts = getWalletImpacts(op);
        for (const [wallet, impact] of newImpacts.entries()) {
          addWalletAdjustment(wallet, impact);
        }
      }
      for (const op of toDelete) {
        const oldImpacts = getWalletImpacts(op.data);
        for (const [wallet, impact] of oldImpacts.entries()) {
          addWalletAdjustment(wallet, -impact);
        }
      }

      const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const [wallet, delta] of walletAdjustments.entries()) {
        if (delta === 0) continue;
        const walletInfo = await resolveWalletRef(t, db, txTenantId, wallet);
        if (!walletInfo) {
          logger.error("Wallet not found during installment update", { tenantId: txTenantId, wallet, delta });
          throw new Error(`Carteira "${wallet}" não encontrada. Operação cancelada.`);
        }
        walletRefs.set(wallet, walletInfo.ref);
      }

      let proposalRef: FirebaseFirestore.DocumentReference | null = null;
      if (proposalId) {
        proposalRef = db.collection("proposals").doc(proposalId);
        const proposalSnap = await t.get(proposalRef);
        if (!proposalSnap.exists) {
          proposalRef = null;
        } else {
          const proposalTenantId = proposalSnap.data()?.tenantId;
          if (proposalTenantId && proposalTenantId !== txTenantId) {
            proposalRef = null;
          }
        }
      }

      for (const [wallet, delta] of walletAdjustments.entries()) {
        if (delta === 0) continue;
        const walletRef = walletRefs.get(wallet);
        if (!walletRef) continue;
        t.update(walletRef, {
          balance: FieldValue.increment(delta),
          updatedAt: now,
        });
      }

      for (const op of toUpdate) {
        t.update(op.doc.ref, op.next);
      }
      for (const op of toCreate) {
        const ref = db.collection(COLLECTION_NAME).doc();
        t.set(ref, op);
      }
      for (const op of toDelete) {
        t.delete(op.ref);
      }

      if (proposalRef) {
        t.update(proposalRef, {
          installmentsWallet: installmentsWallet,
          downPaymentWallet: shouldHaveDownPayment ? downPaymentWallet : null,
          updatedAt: now,
        });
      }
    });
  }

  /**
   * Updates a transaction.
   * Handles recalculation of wallet balances if amount, wallet, or status changes.
   */
  static async updateTransaction(
    userId: string,
    user: any,
    id: string,
    updateData: Partial<CreateTransactionDTO>,
  ) {
    const safeUpdateData = sanitizeTransactionUpdateData(
      (updateData || {}) as Record<string, unknown>,
    );

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      user,
    );

    await db.runTransaction(async (t) => {
      const ref = db.collection(COLLECTION_NAME).doc(id);
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error("Transação não encontrada.");

      const currentData = snap.data();
      if (!currentData) throw new Error("Dados da transação inválidos.");

      if (!isSuperAdmin && currentData.tenantId !== tenantId)
        throw new Error("Acesso negado.");

      const nextStatus =
        safeUpdateData.status &&
        safeUpdateData.status !== currentData.status &&
        ["paid", "pending", "overdue"].includes(
          safeUpdateData.status as string,
        )
          ? (safeUpdateData.status as "paid" | "pending" | "overdue")
          : null;

      // Guard: prevent reverting paid proposal-linked transactions
      if (
        nextStatus &&
        nextStatus !== "paid" &&
        currentData.status === "paid" &&
        currentData.proposalId
      ) {
        const proposalRef = db.collection("proposals").doc(currentData.proposalId);
        const proposalSnap = await t.get(proposalRef);
        if (proposalSnap.exists && proposalSnap.data()?.status === "approved") {
          throw new Error(
            "Não é possível reverter o pagamento de um lançamento vinculado a uma proposta Aprovada. Reverta o status da proposta antes.",
          );
        }
      }

      const nextExtraCosts =
        nextStatus !== null
          ? syncExtraCostsStatus(
              safeUpdateData.extraCosts ?? currentData.extraCosts,
              nextStatus,
              currentData.status,
            )
          : undefined;

      const normalizedUpdateData =
        nextExtraCosts !== undefined
          ? { ...safeUpdateData, extraCosts: nextExtraCosts }
          : safeUpdateData;

      const oldImpacts = getWalletImpacts(currentData);
      const newData = { ...currentData, ...normalizedUpdateData };
      const newImpacts = getWalletImpacts(newData);

      const walletAdjustments = new Map<string, number>();
      for (const [wallet, amount] of oldImpacts.entries()) {
        walletAdjustments.set(wallet, -amount);
      }
      for (const [wallet, amount] of newImpacts.entries()) {
        walletAdjustments.set(
          wallet,
          (walletAdjustments.get(wallet) || 0) + amount,
        );
      }

      // Use the transaction's tenantId for wallet lookup
      const txTenantId = currentData?.tenantId || tenantId;
      const now = Timestamp.now();

      // Firestore transaction rule requires all reads before writes.
      const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const [wallet, adjustment] of walletAdjustments.entries()) {
        if (adjustment === 0) continue;
        const walletInfo = await resolveWalletRef(t, db, txTenantId, wallet);
        if (!walletInfo) {
          logger.error("Wallet not found during transaction update", { tenantId: txTenantId, wallet, adjustment });
          throw new Error(`Carteira "${wallet}" não encontrada. Operação cancelada.`);
        }
        walletRefs.set(wallet, walletInfo.ref);
      }

      let recurOps: DbOp[] = [];
      if (nextStatus) {
        recurOps = await getNextRecurringTransactionOps(
          t,
          db,
          txTenantId,
          now,
          userId,
          currentData,
          nextStatus,
        );
      }

      for (const [wallet, adjustment] of walletAdjustments.entries()) {
        if (adjustment === 0) continue;
        const walletRef = walletRefs.get(wallet);
        if (walletRef) {
          t.update(walletRef, {
            balance: FieldValue.increment(adjustment),
            updatedAt: now,
          });
        }
      }

      // Sync Wallet change to Proposal
      if (
        newData.wallet &&
        currentData.wallet !== newData.wallet &&
        currentData.proposalId
      ) {
        const proposalRef = db
          .collection("proposals")
          .doc(currentData.proposalId);

        const proposalUpdate: any = {};
        if (currentData.isDownPayment) {
          proposalUpdate.downPaymentWallet = newData.wallet;
        } else {
          proposalUpdate.installmentsWallet = newData.wallet;
        }

        t.update(proposalRef, proposalUpdate);
      }

      const finalUpdateData: Record<string, any> = {
        ...normalizedUpdateData,
        updatedAt: now,
      };
      if (nextStatus === "paid") {
        finalUpdateData.paidAt = now;
      } else if (nextStatus) {
        finalUpdateData.paidAt = FieldValue.delete();
      }

      t.update(ref, finalUpdateData);

      for (const op of recurOps) {
        if (op.type === "set") t.set(op.ref, op.data);
        else if (op.type === "delete") t.delete(op.ref);
      }
    });
  }

  /**
   * Batch update status of multiple transactions.
   */
  // Each ID in a batch generates ~2 Firestore writes (transaction + wallet).
  // Firestore transactions cap at 500 writes, so 200 IDs keeps a safe margin.
  static readonly BATCH_STATUS_MAX_IDS = 200;
  static readonly BATCH_UPDATE_MAX_IDS = 100;

  static async updateStatusBatch(
    userId: string,
    user: any,
    ids: string[],
    newStatus: "paid" | "pending" | "overdue",
  ) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

    if (uniqueIds.length > TransactionService.BATCH_STATUS_MAX_IDS) {
      throw new Error(
        `Limite de ${TransactionService.BATCH_STATUS_MAX_IDS} lançamentos por operação em lote excedido. Divida em operações menores.`,
      );
    }

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      user,
    );

    return await db.runTransaction(async (t) => {
      const now = Timestamp.now();
      const transactionsToUpdateWithData: {
        txRef: FirebaseFirestore.DocumentReference;
        currentTxData: any;
        nextTxData: any;
      }[] = [];
      const walletAdjustments = new Map<
        string,
        { tenantId: string; wallet: string; delta: number }
      >();

      // 1) Read all transactions first
      for (const id of uniqueIds) {
        const txRef = db.collection(COLLECTION_NAME).doc(id);
        const txSnap = await t.get(txRef);

        if (!txSnap.exists) continue;

        const txData = txSnap.data() as any;
        if (!txData) continue;

        if (!isSuperAdmin && txData.tenantId !== tenantId) {
          throw new Error("Acesso negado.");
        }

        const nextData = {
          ...txData,
          status: newStatus,
          extraCosts: syncExtraCostsStatus(txData.extraCosts, newStatus, txData.status),
        };

        const oldImpacts = getWalletImpacts(txData);
        const newImpacts = getWalletImpacts(nextData);
        const walletDiffs = new Map<string, number>();

        for (const [wallet, amount] of oldImpacts.entries()) {
          walletDiffs.set(wallet, (walletDiffs.get(wallet) || 0) - amount);
        }
        for (const [wallet, amount] of newImpacts.entries()) {
          walletDiffs.set(wallet, (walletDiffs.get(wallet) || 0) + amount);
        }

        const txTenantId = txData.tenantId || tenantId;

        for (const [wallet, diff] of walletDiffs.entries()) {
          if (diff === 0) continue;
          const key = `${txTenantId}::${wallet}`;
          const prev = walletAdjustments.get(key);
          walletAdjustments.set(key, {
            tenantId: txTenantId,
            wallet,
            delta: (prev?.delta || 0) + diff,
          });
        }

        transactionsToUpdateWithData.push({
          txRef,
          currentTxData: txData,
          nextTxData: nextData,
        });
      }

      // 2) Read all wallets before any write
      const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const [key, adj] of walletAdjustments.entries()) {
        if (adj.delta === 0) continue;
        const walletInfo = await resolveWalletRef(
          t,
          db,
          adj.tenantId,
          adj.wallet,
        );
        if (!walletInfo) {
          logger.error("Wallet not found during batch status update", { tenantId: adj.tenantId, wallet: adj.wallet, delta: adj.delta });
          throw new Error(`Carteira "${adj.wallet}" não encontrada. Operação cancelada.`);
        }
        walletRefs.set(key, walletInfo.ref);
      }

      // 2.5) Read recurrences ops
      const recurOps: DbOp[] = [];
      for (const { currentTxData } of transactionsToUpdateWithData) {
        if (currentTxData.status !== newStatus) {
            const ops = await getNextRecurringTransactionOps(
              t,
              db,
              currentTxData.tenantId || tenantId,
              now,
              userId,
              currentTxData,
              newStatus
            );
            recurOps.push(...ops);
        }
      }

      // 3) Write transaction statuses + paidAt timestamp & sync recurrences
      for (const { txRef, nextTxData } of transactionsToUpdateWithData) {
        const statusUpdate: Record<string, any> = {
          status: newStatus,
          updatedAt: now,
        };
        if (Array.isArray(nextTxData.extraCosts)) {
          statusUpdate.extraCosts = nextTxData.extraCosts;
        }
        if (newStatus === "paid") {
          statusUpdate.paidAt = now;
        } else {
          statusUpdate.paidAt = FieldValue.delete();
        }
        t.update(txRef, statusUpdate);
      }

      // 4) Write wallet balance deltas
      for (const [key, adj] of walletAdjustments.entries()) {
        if (adj.delta === 0) continue;
        const walletRef = walletRefs.get(key);
        if (!walletRef) continue;

        t.update(walletRef, {
          balance: FieldValue.increment(adj.delta),
          updatedAt: now,
        });
      }

      // 5) Write recurrences
      for (const op of recurOps) {
        if (op.type === "set") t.set(op.ref, op.data);
        else if (op.type === "delete") t.delete(op.ref);
      }

      // 6) Sync proposal updatedAt for affected proposals
      const proposalIds = new Set<string>();
      for (const { currentTxData } of transactionsToUpdateWithData) {
        if (currentTxData.proposalId) {
          proposalIds.add(currentTxData.proposalId);
        }
      }
      for (const proposalId of proposalIds) {
        const proposalRef = db.collection("proposals").doc(proposalId);
        t.update(proposalRef, { updatedAt: now });
      }

      return uniqueIds.length;
    });
  }

  /**
   * Atomically updates multiple transactions in a single Firestore transaction.
   * Recalculates wallet balances for all affected wallets correctly.
   * Intended for bulk field changes (wallet, amount, date, etc.).
   */
  static async updateTransactionsBatch(
    userId: string,
    user: any,
    updates: Array<{ id: string; data: Record<string, unknown> }>,
  ) {
    if (updates.length === 0) return 0;
    if (updates.length > TransactionService.BATCH_UPDATE_MAX_IDS) {
      throw new Error(
        `Limite de ${TransactionService.BATCH_UPDATE_MAX_IDS} lançamentos por operação em lote excedido.`,
      );
    }

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(userId, "canEdit", user);

    return await db.runTransaction(async (t) => {
      const now = Timestamp.now();
      type TxEntry = {
        ref: FirebaseFirestore.DocumentReference;
        current: Record<string, any>;
        safeUpdate: Record<string, unknown>;
      };
      const entries: TxEntry[] = [];
      const walletAdjustments = new Map<string, { tenantId: string; delta: number }>();

      // Phase 1: read all transaction docs
      for (const { id, data } of updates) {
        const ref = db.collection(COLLECTION_NAME).doc(id);
        const snap = await t.get(ref);
        if (!snap.exists) continue;

        const current = snap.data() as Record<string, any>;
        if (!current) continue;
        if (!isSuperAdmin && current.tenantId !== tenantId) throw new Error("Acesso negado.");

        const safeUpdate = sanitizeTransactionUpdateData(data);
        const next = { ...current, ...safeUpdate };

        const oldImpacts = getWalletImpacts(current);
        const newImpacts = getWalletImpacts(next);
        const txTenantId = current.tenantId as string || tenantId;

        for (const [wallet, amt] of oldImpacts.entries()) {
          const key = `${txTenantId}::${wallet}`;
          const prev = walletAdjustments.get(key);
          walletAdjustments.set(key, { tenantId: txTenantId, delta: (prev?.delta || 0) - amt });
        }
        for (const [wallet, amt] of newImpacts.entries()) {
          const key = `${txTenantId}::${wallet}`;
          const prev = walletAdjustments.get(key);
          walletAdjustments.set(key, { tenantId: txTenantId, delta: (prev?.delta || 0) + amt });
        }

        entries.push({ ref, current, safeUpdate });
      }

      // Phase 2: read all wallet docs (must precede any write)
      const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const [key, adj] of walletAdjustments.entries()) {
        if (adj.delta === 0) continue;
        const wallet = key.split("::")[1];
        const walletInfo = await resolveWalletRef(t, db, adj.tenantId, wallet);
        if (!walletInfo) {
          logger.error("Wallet not found during batch update", { tenantId: adj.tenantId, wallet, delta: adj.delta });
          throw new Error(`Carteira "${wallet}" não encontrada. Operação cancelada.`);
        }
        walletRefs.set(key, walletInfo.ref);
      }

      // Phase 3: write all updates
      for (const { ref, current, safeUpdate } of entries) {
        const nextStatus = (safeUpdate.status as string | undefined);
        const statusChanged = nextStatus && nextStatus !== current.status;
        const finalUpdate: Record<string, any> = { ...safeUpdate, updatedAt: now };
        if (statusChanged && nextStatus === "paid") {
          finalUpdate.paidAt = now;
        } else if (statusChanged) {
          finalUpdate.paidAt = FieldValue.delete();
        }
        t.update(ref, finalUpdate);
      }

      for (const [key, adj] of walletAdjustments.entries()) {
        if (adj.delta === 0) continue;
        const walletRef = walletRefs.get(key);
        if (!walletRef) continue;
        t.update(walletRef, { balance: FieldValue.increment(adj.delta), updatedAt: now });
      }

      return entries.length;
    });
  }

  /**
   * Atomically updates status for all transactions belonging to a group.
   * Discovers group members server-side (authoritative — no stale client IDs).
   * Supports installmentGroupId, recurringGroupId, and proposalGroupId.
   */
  static async updateGroupStatus(
    userId: string,
    user: any,
    groupId: string,
    newStatus: "paid" | "pending" | "overdue",
  ) {
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(userId, "canEdit", user);

    // Discover all members of this group server-side before entering the transaction.
    const [installmentSnap, recurringSnap, proposalSnap] = await Promise.all([
      db.collection(COLLECTION_NAME)
        .where("tenantId", "==", tenantId)
        .where("installmentGroupId", "==", groupId)
        .get(),
      db.collection(COLLECTION_NAME)
        .where("tenantId", "==", tenantId)
        .where("recurringGroupId", "==", groupId)
        .get(),
      db.collection(COLLECTION_NAME)
        .where("tenantId", "==", tenantId)
        .where("proposalGroupId", "==", groupId)
        .get(),
    ]);

    const seen = new Set<string>();
    const ids: string[] = [];
    for (const snap of [installmentSnap, recurringSnap, proposalSnap]) {
      for (const doc of snap.docs) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          if (!isSuperAdmin && doc.data().tenantId !== tenantId) {
            throw new Error("Acesso negado.");
          }
          ids.push(doc.id);
        }
      }
    }

    if (ids.length === 0) throw new Error("Grupo não encontrado.");
    if (ids.length > TransactionService.BATCH_STATUS_MAX_IDS) {
      throw new Error(
        `Grupo contém ${ids.length} lançamentos, excedendo o limite de ${TransactionService.BATCH_STATUS_MAX_IDS} por operação.`,
      );
    }

    return TransactionService.updateStatusBatch(userId, user, ids, newStatus);
  }

  /**
   * Deletes a transaction and reverts any wallet balance changes.
   */
  static async deleteTransaction(userId: string, user: any, id: string) {
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canDelete",
      user,
    );

    await db.runTransaction(async (t) => {
      const ref = db.collection(COLLECTION_NAME).doc(id);
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error("Transação não encontrada.");

      const currentData = snap.data();
      if (!isSuperAdmin && currentData?.tenantId !== tenantId)
        throw new Error("Acesso negado.");

      // Check if linked to an approved proposal
      if (currentData?.proposalId) {
        const proposalRef = db
          .collection("proposals")
          .doc(currentData.proposalId);
        const proposalSnap = await t.get(proposalRef);

        if (proposalSnap.exists) {
          const proposalData = proposalSnap.data();
          if (proposalData?.status === "approved") {
            throw new Error(
              "Não é possível excluir um lançamento vinculado a uma proposta Aprovada. Reverta o status da proposta para Rascunho antes de excluir.",
            );
          }
        }
      }

      const txTenantId = currentData?.tenantId || tenantId;
      const walletAdjustments = new Map<string, number>();

      const addImpact = (
        wallet: string | null | undefined,
        amount: number,
        isIncome: boolean,
      ) => {
        if (!wallet) return;
        const delta = (isIncome ? 1 : -1) * (amount || 0);
        walletAdjustments.set(
          wallet,
          (walletAdjustments.get(wallet) || 0) + delta,
        );
      };

      // 1. Calculate main transaction impact
      if (currentData?.status === "paid" && currentData?.wallet) {
        addImpact(
          currentData.wallet,
          currentData.amount,
          currentData.type === "income",
        );
      }

      // 2. Calculate extra costs impacts
      if (currentData?.extraCosts && Array.isArray(currentData.extraCosts)) {
        for (const ec of currentData.extraCosts) {
          if (ec.status === "paid" && (ec.wallet || currentData.wallet)) {
            // Extra costs add to the absolute value of the parent transaction
            addImpact(
              ec.wallet || currentData.wallet,
              ec.amount,
              currentData.type === "income",
            );
          }
        }
      }

      // 3. Resolve wallet refs (must read before write)
      const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const [wallet, adj] of walletAdjustments.entries()) {
        if (adj === 0) continue;
        const w = await resolveWalletRef(t, db, txTenantId, wallet);
        if (!w) {
          logger.error("Wallet not found during transaction deletion", { tenantId: txTenantId, wallet, adjustment: adj });
          throw new Error(`Carteira "${wallet}" não encontrada. Operação cancelada.`);
        }
        walletRefs.set(wallet, w.ref);
      }

      // 4. Revert impact
      for (const [wallet, adj] of walletAdjustments.entries()) {
        if (adj === 0) continue;
        const walletRef = walletRefs.get(wallet);
        if (walletRef) {
          t.update(walletRef, {
            balance: FieldValue.increment(-adj),
            updatedAt: Timestamp.now(),
          });
        }
      }

      t.delete(ref);
    });
  }

  /**
   * Deletes all transactions in a group atomically, reverting all wallet balances.
   */
  static async deleteTransactionGroup(userId: string, user: any, groupId: string) {
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(userId, "canDelete", user);

    await db.runTransaction(async (t) => {
      const installmentSnap = await t.get(
        db.collection(COLLECTION_NAME).where("tenantId", "==", tenantId).where("installmentGroupId", "==", groupId),
      );
      const recurringSnap = await t.get(
        db.collection(COLLECTION_NAME).where("tenantId", "==", tenantId).where("recurringGroupId", "==", groupId),
      );

      const seen = new Set<string>();
      const docs = [...installmentSnap.docs, ...recurringSnap.docs].filter((d) => {
        if (seen.has(d.id)) return false;
        seen.add(d.id);
        return true;
      });

      if (docs.length === 0) throw new Error("Grupo não encontrado.");

      // Validate tenant access on the first authoritative doc.
      if (!isSuperAdmin && docs[0].data().tenantId !== tenantId) {
        throw new Error("Acesso negado.");
      }

      // BUG-10: Also find orphan down payments linked via proposalGroupId.
      // Old down payments (pre-migration) were created without installmentGroupId
      // but share a proposalGroupId with their sibling installments.
      const proposalGroupIds = new Set<string>();
      docs.forEach((d) => {
        const pgId = d.data().proposalGroupId as string | undefined;
        if (pgId) proposalGroupIds.add(pgId);
      });
      for (const pgId of proposalGroupIds) {
        const pgSnap = await t.get(
          db.collection(COLLECTION_NAME)
            .where("tenantId", "==", tenantId)
            .where("proposalGroupId", "==", pgId),
        );
        pgSnap.docs.forEach((d) => {
          if (!seen.has(d.id)) {
            seen.add(d.id);
            docs.push(d);
          }
        });
      }

      // BUG-11: Check proposal lock across ALL docs, not just the first.
      // In normal data every doc shares the same proposalId, but defensively
      // we check all unique proposalIds to guard against corrupted data.
      const proposalIds = new Set<string>();
      docs.forEach((d) => {
        const pid = d.data().proposalId as string | undefined;
        if (pid) proposalIds.add(pid);
      });
      for (const proposalId of proposalIds) {
        const proposalSnap = await t.get(db.collection("proposals").doc(proposalId));
        if (proposalSnap.exists && proposalSnap.data()?.status === "approved") {
          throw new Error(
            "Não é possível excluir lançamentos vinculados a uma proposta Aprovada. Reverta o status da proposta para Rascunho antes de excluir.",
          );
        }
      }

      const txTenantId = (docs[0].data().tenantId as string) || tenantId;
      const walletAdjustments = new Map<string, number>();

      for (const doc of docs) {
        const data = doc.data();
        const addImpact = (wallet: string | null | undefined, amount: number, isIncome: boolean) => {
          if (!wallet) return;
          const delta = (isIncome ? 1 : -1) * (amount || 0);
          walletAdjustments.set(wallet, (walletAdjustments.get(wallet) || 0) + delta);
        };
        if (data.status === "paid" && data.wallet) {
          addImpact(data.wallet, data.amount, data.type === "income");
        }
        if (data.extraCosts && Array.isArray(data.extraCosts)) {
          for (const ec of data.extraCosts) {
            if (ec.status === "paid" && (ec.wallet || data.wallet)) {
              addImpact(ec.wallet || data.wallet, ec.amount, data.type === "income");
            }
          }
        }
      }

      // Resolve wallet refs (reads before writes)
      const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const [wallet, adj] of walletAdjustments.entries()) {
        if (adj === 0) continue;
        const w = await resolveWalletRef(t, db, txTenantId, wallet);
        if (!w) {
          logger.error("Wallet not found during group deletion", { tenantId: txTenantId, wallet, adjustment: adj });
          throw new Error(`Carteira "${wallet}" não encontrada. Operação cancelada.`);
        }
        walletRefs.set(wallet, w.ref);
      }

      for (const [wallet, adj] of walletAdjustments.entries()) {
        if (adj === 0) continue;
        const walletRef = walletRefs.get(wallet);
        if (walletRef) {
          t.update(walletRef, { balance: FieldValue.increment(-adj), updatedAt: Timestamp.now() });
        }
      }

      for (const doc of docs) {
        t.delete(doc.ref);
      }
    });
  }

  /**
   * Registers a partial payment atomically:
   * updates the original transaction to the paid partial amount and
   * creates a new pending transaction for the remaining amount.
   */
  static async registerPartialPayment(
    userId: string,
    user: any,
    id: string,
    partialAmount: number,
    date: string,
  ) {
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(userId, "canEdit", user);

    await db.runTransaction(async (t) => {
      const ref = db.collection(COLLECTION_NAME).doc(id);
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error("Transação não encontrada.");

      const data = snap.data()!;
      const txTenantId = data.tenantId as string;
      if (!isSuperAdmin && txTenantId !== tenantId) throw new Error("Acesso negado.");
      if (partialAmount <= 0) throw new Error("Valor parcial deve ser maior que zero.");

      const remainingAmount = roundCurrency(data.amount - partialAmount);
      if (remainingAmount <= 0) throw new Error("Valor parcial deve ser menor que o valor total.");

      const now = Timestamp.now();
      const wallet = data.wallet as string | null | undefined;
      const isIncome = data.type === "income";

      // Wallet delta: if previously paid → refund remaining; if pending → credit partial
      let walletDelta = 0;
      if (wallet) {
        if (data.status === "paid") {
          walletDelta = (isIncome ? -1 : 1) * remainingAmount;
        } else {
          walletDelta = (isIncome ? 1 : -1) * partialAmount;
        }
      }

      if (wallet && walletDelta !== 0) {
        const w = await resolveWalletRef(t, db, txTenantId, wallet);
        if (!w) throw new Error(`Carteira "${wallet}" não encontrada. Operação cancelada.`);
        t.update(w.ref, { balance: FieldValue.increment(walletDelta), updatedAt: now });
      }

      // Mark original as paid with the partial amount; paidAt must be set explicitly
      // because this path bypasses the generic updateTransaction paidAt logic.
      t.update(ref, {
        amount: partialAmount,
        status: "paid",
        date,
        isPartialPayment: true,
        paidAt: now,
        updatedAt: now,
      });

      // Remaining amount is always a new pending obligation regardless of whether
      // the original was overdue — the user just settled part of it.
      const remainingRef = db.collection(COLLECTION_NAME).doc();
      t.set(remainingRef, {
        ...data,
        amount: remainingAmount,
        status: "pending",
        isPartialPayment: false,
        parentTransactionId: id,
        paidAt: null,
        createdAt: now,
        updatedAt: now,
        createdById: userId,
      });
    });
  }
}

// === AI Tool Service Functions ===
// Pure functions for AI executor — no req/res dependency.
// These are separate from the TransactionService class above.

import { randomUUID } from "crypto";

export interface TransactionListItem {
  id: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  date: string;
  wallet: string;
  category: string;
}

export interface CreateTransactionForAiParams {
  type: "income" | "expense";
  description: string;
  amount: number;
  walletId: string;
  date: string; // YYYY-MM-DD
  category?: string;
  installments?: number;
  proposalId?: string;
}

export async function listTransactionsForAi(
  tenantId: string,
  opts?: {
    type?: string;
    walletId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  },
): Promise<TransactionListItem[]> {
  const maxLimit = Math.min(opts?.limit || 20, 100);

  let query: FirebaseFirestore.Query = db
    .collection(COLLECTION_NAME)
    .where("tenantId", "==", tenantId);

  if (opts?.type) {
    query = query.where("type", "==", opts.type);
  }

  if (opts?.walletId) {
    query = query.where("wallet", "==", opts.walletId);
  }

  if (opts?.startDate) {
    query = query.where("date", ">=", opts.startDate);
  }

  if (opts?.endDate) {
    query = query.where("date", "<=", opts.endDate);
  }

  query = query.orderBy("date", "desc").limit(maxLimit);

  const snap = await query.get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      description: data.description || "",
      amount: data.amount || 0,
      type: data.type || "",
      status: data.status || "",
      date: data.date || "",
      wallet: data.wallet || "",
      category: data.category || "",
    };
  });
}

export async function createTransactionForAi(
  params: CreateTransactionForAiParams,
  tenantId: string,
  uid: string,
): Promise<{ id: string; description: string; amount: number; status: string }> {
  const now = Timestamp.now();
  const installments = params.installments && params.installments > 1 ? params.installments : 1;

  if (installments === 1) {
    const txRef = db.collection(COLLECTION_NAME).doc();
    const txData: Record<string, unknown> = {
      tenantId,
      type: params.type,
      description: params.description,
      amount: roundCurrency(params.amount),
      status: "pending",
      date: params.date,
      wallet: params.walletId,
      category: params.category || "",
      createdById: uid,
      createdAt: now,
      updatedAt: now,
    };

    if (params.proposalId) txData.proposalId = params.proposalId;

    await txRef.set(txData);

    return {
      id: txRef.id,
      description: params.description,
      amount: roundCurrency(params.amount),
      status: "pending",
    };
  }

  // Multi-installment: create multiple docs atomically
  const installmentGroupId = randomUUID();
  const batch = db.batch();
  const perInstallment = roundCurrency(params.amount / installments);
  let firstId = "";

  for (let i = 1; i <= installments; i++) {
    const isLast = i === installments;
    const totalSoFar = roundCurrency(perInstallment * (installments - 1));
    const installmentAmount = isLast
      ? roundCurrency(params.amount - totalSoFar)
      : perInstallment;

    // Each installment date advances by 1 month from the base date
    const installmentDate = addDateMonths(params.date, i - 1);

    const txRef = db.collection(COLLECTION_NAME).doc();
    if (i === 1) firstId = txRef.id;

    const txData: Record<string, unknown> = {
      tenantId,
      type: params.type,
      description: `${params.description} (${i}/${installments})`,
      amount: installmentAmount,
      status: "pending",
      date: installmentDate,
      wallet: params.walletId,
      category: params.category || "",
      isInstallment: true,
      installmentGroupId,
      installmentNumber: i,
      installmentCount: installments,
      createdById: uid,
      createdAt: now,
      updatedAt: now,
    };

    if (params.proposalId) txData.proposalId = params.proposalId;

    batch.set(txRef, txData);
  }

  await batch.commit();

  return {
    id: firstId,
    description: params.description,
    amount: roundCurrency(params.amount),
    status: "pending",
  };
}

export async function deleteTransactionForAi(
  transactionId: string,
  tenantId: string,
): Promise<{ id: string; deleted: boolean }> {
  const snap = await db.collection(COLLECTION_NAME).doc(transactionId).get();

  if (!snap.exists) {
    throw new Error("Transação não encontrada.");
  }

  const data = snap.data()!;

  if (data.tenantId !== tenantId) {
    throw new Error("Transação não pertence a este tenant.");
  }

  await db.collection(COLLECTION_NAME).doc(transactionId).delete();

  return { id: transactionId, deleted: true };
}

export async function payInstallmentForAi(
  transactionId: string,
  installmentNumber: number,
  tenantId: string,
  paidAt?: string,
): Promise<{ id: string; installmentNumber: number; status: string }> {
  await db.runTransaction(async (t) => {
    const ref = db.collection(COLLECTION_NAME).doc(transactionId);
    const snap = await t.get(ref);

    if (!snap.exists) {
      throw new Error("Transação não encontrada.");
    }

    const data = snap.data()!;

    if (data.tenantId !== tenantId) {
      throw new Error("Transação não pertence a este tenant.");
    }

    if (!data.isInstallment) {
      throw new Error("Esta transação não é uma parcela.");
    }

    if (data.installmentNumber !== installmentNumber) {
      throw new Error(
        `Número de parcela não coincide: esperado ${data.installmentNumber}, recebido ${installmentNumber}.`,
      );
    }

    if (data.status === "paid") {
      throw new Error("Parcela ja esta paga.");
    }

    const now = Timestamp.now();
    const update: Record<string, unknown> = {
      status: "paid",
      paidAt: paidAt || now.toDate().toISOString(),
      updatedAt: now,
    };

    t.update(ref, update);

    // Update wallet balance if wallet is set
    if (data.wallet && data.amount) {
      const walletSnap = await db
        .collection("wallets")
        .where("tenantId", "==", tenantId)
        .where("name", "==", data.wallet)
        .limit(1)
        .get();

      // Also try by ID
      const walletByIdSnap = await t.get(
        db.collection("wallets").doc(data.wallet as string),
      );

      let walletRef: FirebaseFirestore.DocumentReference | null = null;

      if (walletByIdSnap.exists && walletByIdSnap.data()?.tenantId === tenantId) {
        walletRef = walletByIdSnap.ref;
      } else if (!walletSnap.empty) {
        walletRef = walletSnap.docs[0].ref;
      }

      if (walletRef) {
        const delta = data.type === "income" ? data.amount : -(data.amount as number);
        t.update(walletRef, {
          balance: FieldValue.increment(delta),
          updatedAt: now,
        });
      }
    }
  });

  return { id: transactionId, installmentNumber, status: "paid" };
}

function addDateMonths(dateStr: string, months: number): string {
  if (months === 0) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const totalMonths = year * 12 + month + months;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = totalMonths % 12;
  const daysInNewMonth = new Date(newYear, newMonth + 1, 0).getDate();
  const newDay = Math.min(day, daysInNewMonth);
  return `${newYear.toString().padStart(4, "0")}-${(newMonth + 1).toString().padStart(2, "0")}-${newDay.toString().padStart(2, "0")}`;
}
