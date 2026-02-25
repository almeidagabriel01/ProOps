import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  checkFinancialPermission,
  resolveWalletRef,
  addMonths,
} from "../../lib/finance-helpers";
import { CreateTransactionDTO } from "../helpers/transaction-validation";

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
  "notes",
  "extraCosts",
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

function isDownPaymentLikeDoc(data: Record<string, any>): boolean {
  return !!data?.isDownPayment || toNumber(data?.installmentNumber, -1) === 0;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

      const shouldGenerateInstallments =
        data.isInstallment &&
        (data.installmentCount || 0) > 1 &&
        (!data.installmentNumber || data.installmentNumber === 1);

      if (shouldGenerateInstallments) {
        const count = data.installmentCount!;
        const groupId = data.installmentGroupId || `gen_${now.toMillis()}`;
        const baseAmount = data.amount;

        for (let i = 0; i < count; i++) {
          const isFirst = i === 0;
          const currentStatus = isFirst ? data.status : "pending";

          // Date (launch date) stays the same for all installments
          const currentDate = data.date;

          // DueDate (vencimento) increments by month for each installment
          // If no dueDate provided, use date as base
          const baseDueDate = data.dueDate || data.date;
          const currentDueDate = addMonths(baseDueDate, i);

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
            isInstallment: true,
            downPaymentType: data.downPaymentType || null,
            downPaymentPercentage: data.downPaymentPercentage || null,
            installmentCount: count,
            installmentNumber: i + 1,
            installmentGroupId: groupId,
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
          installmentCount: data.installmentCount || null,
          installmentNumber: data.installmentNumber || null,
          installmentGroupId: data.installmentGroupId || null,
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
        if (walletInfo) {
          t.update(walletInfo.ref, {
            balance: FieldValue.increment(adjustment),
            updatedAt: now,
          });
        }
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
        const nextInstallment = {
          tenantId: txTenantId,
          type,
          description,
          amount: installmentAmounts[i] ?? 0,
          date: launchDate,
          dueDate: addMonths(baseInstallmentDueDate, i),
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
          date: downPaymentDueDate,
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
        if (walletInfo) walletRefs.set(wallet, walletInfo.ref);
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

      // Calc Impact logic
      const getWalletImpacts = (data: any) => {
        const impacts = new Map<string, number>();
        const addImpact = (
          wallet: string | null | undefined,
          amount: number,
          type: string,
        ) => {
          if (!wallet) return;
          const delta = (type === "income" ? 1 : -1) * (amount || 0);
          impacts.set(wallet, (impacts.get(wallet) || 0) + delta);
        };

        if (data?.status === "paid" && data?.wallet) {
          addImpact(data.wallet, data.amount, data.type);
        }

        if (data?.extraCosts && Array.isArray(data.extraCosts)) {
          for (const ec of data.extraCosts) {
            if (ec.status === "paid" && (ec.wallet || data.wallet)) {
              // Extra Costs add to the absolute value of the parent transaction
              addImpact(ec.wallet || data.wallet, ec.amount, data.type);
            }
          }
        }
        return impacts;
      };

      const oldImpacts = getWalletImpacts(currentData);
      const newData = { ...currentData, ...safeUpdateData };
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
        if (walletInfo) walletRefs.set(wallet, walletInfo.ref);
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

      t.update(ref, { ...safeUpdateData, updatedAt: Timestamp.now() });
    });
  }

  /**
   * Batch update status of multiple transactions.
   */
  static async updateStatusBatch(
    userId: string,
    user: any,
    ids: string[],
    newStatus: "paid" | "pending" | "overdue",
  ) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      user,
    );

    return await db.runTransaction(async (t) => {
      const now = Timestamp.now();
      const transactionsToUpdate: FirebaseFirestore.DocumentReference[] = [];
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

        const oldImpact =
          txData.status === "paid" && txData.wallet
            ? (txData.type === "income" ? 1 : -1) * (txData.amount || 0)
            : 0;

        const nextData = {
          status: newStatus,
          wallet: txData.wallet,
          type: txData.type,
          amount: txData.amount,
        };
        const newImpact =
          nextData.status === "paid" && nextData.wallet
            ? (nextData.type === "income" ? 1 : -1) * (nextData.amount || 0)
            : 0;

        const diff = newImpact - oldImpact;
        const txTenantId = txData.tenantId || tenantId;

        if (diff !== 0 && nextData.wallet) {
          const key = `${txTenantId}::${nextData.wallet}`;
          const prev = walletAdjustments.get(key);
          walletAdjustments.set(key, {
            tenantId: txTenantId,
            wallet: nextData.wallet,
            delta: (prev?.delta || 0) + diff,
          });
        }

        transactionsToUpdate.push(txRef);
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
        if (walletInfo) {
          walletRefs.set(key, walletInfo.ref);
        }
      }

      // 3) Write transaction statuses + paidAt timestamp
      for (const txRef of transactionsToUpdate) {
        const statusUpdate: Record<string, any> = {
          status: newStatus,
          updatedAt: now,
        };
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

      return uniqueIds.length;
    });
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
        if (w) walletRefs.set(wallet, w.ref);
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
}
