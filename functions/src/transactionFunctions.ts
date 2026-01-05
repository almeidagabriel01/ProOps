/**
 * Cloud Functions: Transaction Management
 *
 * Secure CRUD operations for financial transactions with:
 * - Authentication verification
 * - Permission checks (MASTER or MEMBER with 'financial' page access)
 * - Tenant isolation
 * - Atomic updates (Transaction + Wallet)
 * - Server-side installment generation
 */

import * as functions from "firebase-functions";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { db } from "./init";

// ============================================
// TYPES
// ============================================

type TransactionType = "income" | "expense";
type TransactionStatus = "paid" | "pending" | "overdue";

interface TransactionInput {
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  dueDate?: string;
  status: TransactionStatus;
  clientId?: string;
  clientName?: string;
  proposalId?: string;
  category?: string;
  wallet?: string; // Can be ID or Name (for legacy support)
  isInstallment?: boolean; // If true, backend will generate installments if installmentCount > 1
  installmentCount?: number;
  installmentNumber?: number;
  installmentGroupId?: string;
  notes?: string;
}

type CreateTransactionInput = TransactionInput;

interface UpdateTransactionInput {
  transactionId: string;
  type?: TransactionType;
  description?: string;
  amount?: number;
  date?: string;
  dueDate?: string;
  status?: TransactionStatus;
  clientId?: string;
  clientName?: string;
  proposalId?: string;
  category?: string;
  wallet?: string;
  isInstallment?: boolean;
  installmentCount?: number;
  installmentNumber?: number;
  installmentGroupId?: string;
  notes?: string;
}

interface DeleteTransactionInput {
  transactionId: string;
}

interface UserDoc {
  role: "MASTER" | "MEMBER";
  masterId: string | null;
  tenantId: string;
  companyId?: string;
  subscription?: { status: string };
}

interface WalletDoc {
  name: string;
  balance: number;
  tenantId: string;
}

interface TransactionDoc {
  tenantId: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  dueDate?: string | null;
  status: TransactionStatus;
  clientId?: string | null;
  clientName?: string | null;
  proposalId?: string | null;
  category?: string | null;
  wallet?: string | null;
  isInstallment?: boolean;
  installmentCount?: number | null;
  installmentNumber?: number | null;
  installmentGroupId?: string | null;
  notes?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdById: string;
}

const COLLECTION_NAME = "transactions";

// ============================================
// HELPER: Date Math (Add Months safely)
// ============================================
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  const targetMonth = d.getMonth() + months;
  const yearDiff = Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const day = d.getDate();

  const newDate = new Date(d.getFullYear() + yearDiff, month, 1);
  // Check if day exists in new month (e.g. Jan 31 -> Feb 28)
  const daysInMonth = new Date(
    d.getFullYear() + yearDiff,
    month + 1,
    0
  ).getDate();
  newDate.setDate(Math.min(day, daysInMonth));

  // Keep original time components if any, but usually we just want YYYY-MM-DD
  return newDate.toISOString().split("T")[0];
}

// ============================================
// HELPER: Resolve Wallet (ID or Name)
// ============================================
async function resolveWalletRef(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  identifier: string
): Promise<{
  ref: FirebaseFirestore.DocumentReference;
  data: WalletDoc;
} | null> {
  if (!identifier) return null;

  // 1. Try as ID
  const directRef = db.collection("wallets").doc(identifier);
  const directSnap = await transaction.get(directRef);

  if (directSnap.exists) {
    const data = directSnap.data() as WalletDoc;
    if (data.tenantId === tenantId) {
      return { ref: directRef, data };
    }
  }

  // 2. Try as Name (Fallback)
  const nameQuery = db
    .collection("wallets")
    .where("tenantId", "==", tenantId)
    .where("name", "==", identifier)
    .limit(1);

  const querySnap = await transaction.get(nameQuery);

  if (!querySnap.empty) {
    const doc = querySnap.docs[0];
    return { ref: doc.ref, data: doc.data() as WalletDoc };
  }

  return null;
}

// ============================================
// CREATE TRANSACTION (Atomic + Batch Generation)
// ============================================

export const createTransaction = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CreateTransactionInput, context) => {
    // const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const now = Timestamp.now();

    // 1. Input Validation
    if (
      !data.description ||
      !data.amount ||
      !data.date ||
      !data.type ||
      !data.status
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Campos obrigatórios faltando."
      );
    }

    // 2. Parallel Fetch (User & Permissions)
    const userRef = db.collection("users").doc(userId);
    const permRef = userRef.collection("permissions").doc("financial");

    const [userSnap, permSnap] = await Promise.all([
      userRef.get(),
      permRef.get(),
    ]);

    if (!userSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Usuário não encontrado."
      );
    }

    const userData = userSnap.data() as UserDoc;
    const tenantId = userData.tenantId || userData.companyId;

    if (!tenantId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Usuário sem tenantId."
      );
    }

    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && userData.subscription);

    if (!isMaster) {
      if (!permSnap.exists || !permSnap.data()?.canCreate) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Sem permissão para criar transações."
        );
      }
    }

    // 3. Execute Atomic Transaction
    try {
      const result = await db.runTransaction(async (t) => {
        // B. Prepare Data Generation (Single or Installments)
        const transactionsToCreate: TransactionDoc[] = [];
        const walletAdjustments = new Map<string, number>(); // Identifier -> Amount Adjustment

        // DEBUG: Internal Log
        console.log("CreateTransaction Data:", JSON.stringify(data));

        const shouldGenerateInstallments =
          data.isInstallment &&
          (data.installmentCount || 0) > 1 &&
          (!data.installmentNumber || data.installmentNumber === 1); // Allow generation if number is missing OR 1

        console.log(
          "Should Generate Installments:",
          shouldGenerateInstallments
        );

        if (shouldGenerateInstallments) {
          const count = data.installmentCount!;
          const groupId = data.installmentGroupId || `gen_${now.toMillis()}`;
          const baseAmount = data.amount; // Assuming input is PER INSTALLMENT

          console.log(`Generating ${count} installments for group ${groupId}`);

          for (let i = 0; i < count; i++) {
            const isFirst = i === 0;
            // First one keeps status, others are pending
            const currentStatus = isFirst ? data.status : "pending";
            const currentDate = isFirst ? data.date : addMonths(data.date, i);
            const currentDueDate = data.dueDate
              ? isFirst
                ? data.dueDate
                : addMonths(data.dueDate, i)
              : undefined;

            transactionsToCreate.push({
              tenantId,
              type: data.type,
              description: data.description.trim(),
              amount: baseAmount,
              date: currentDate,
              dueDate: currentDueDate || null,
              status: currentStatus,
              clientId: data.clientId || null,
              clientName: data.clientName || null,
              proposalId: data.proposalId || null,
              category: data.category || null,
              wallet: data.wallet || null,
              isInstallment: true,
              installmentCount: count,
              installmentNumber: i + 1,
              installmentGroupId: groupId,
              notes: data.notes || null,
              createdAt: now,
              updatedAt: now,
              createdById: userId,
            });

            // Calculate wallet impact
            if (currentStatus === "paid" && data.wallet) {
              const sign = data.type === "income" ? 1 : -1;
              const adj = sign * baseAmount;
              walletAdjustments.set(
                data.wallet,
                (walletAdjustments.get(data.wallet) || 0) + adj
              );
            }
          }
        } else {
          // Single Transaction
          transactionsToCreate.push({
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
            isInstallment: !!data.isInstallment,
            installmentCount: data.installmentCount || null,
            installmentNumber: data.installmentNumber || null,
            installmentGroupId: data.installmentGroupId || null,
            notes: data.notes || null,
            createdAt: now,
            updatedAt: now,
            createdById: userId,
          });

          if (data.status === "paid" && data.wallet) {
            const sign = data.type === "income" ? 1 : -1;
            const adj = sign * data.amount;
            walletAdjustments.set(data.wallet, adj);
          }
        }

        // C. Update Wallets (if any)
        for (const [
          walletIdentifier,
          adjustment,
        ] of walletAdjustments.entries()) {
          if (adjustment === 0) continue;

          const walletInfo = await resolveWalletRef(
            t,
            db,
            tenantId,
            walletIdentifier
          );
          if (walletInfo) {
            const newBalance = (walletInfo.data.balance || 0) + adjustment;
            t.update(walletInfo.ref, {
              balance: newBalance,
              updatedAt: now,
            });
          } else {
            console.warn(
              `Wallet '${walletIdentifier}' not found for tenant '${tenantId}' during transaction creation.`
            );
          }
        }

        // D. Write Transactions
        const createdIds: string[] = [];
        const collectionRef = db.collection(COLLECTION_NAME);

        for (const txData of transactionsToCreate) {
          const ref = collectionRef.doc();
          createdIds.push(ref.id);
          t.set(ref, txData);
        }

        return {
          success: true,
          transactionId: createdIds[0], // Return first ID
          transactionIds: createdIds,
          message:
            transactionsToCreate.length > 1
              ? `${transactionsToCreate.length} parcelas criadas com sucesso.`
              : "Transação criada com sucesso.",
        };
      });

      return result;
    } catch (error) {
      console.error("Create Transaction Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });

// ============================================
// UPDATE TRANSACTION (Atomic)
// ============================================
export const updateTransaction = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateTransactionInput, context) => {
    // const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }
    const userId = context.auth.uid;
    const { transactionId, ...updateData } = data;

    if (!transactionId) {
      throw new functions.https.HttpsError("invalid-argument", "ID inválido.");
    }

    // 2. Parallel Fetch (User & Permission)
    const userRef = db.collection("users").doc(userId);
    const permRef = userRef.collection("permissions").doc("financial");

    const [userSnap, permSnap] = await Promise.all([
      userRef.get(),
      permRef.get(),
    ]);

    if (!userSnap.exists)
      throw new functions.https.HttpsError("not-found", "User not found");

    const userData = userSnap.data() as UserDoc;
    const tenantId = userData.tenantId || userData.companyId;
    const isSuperAdmin = (userData.role as string)?.toLowerCase() === "superadmin";

    if (!tenantId && !isSuperAdmin)
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Usuário sem tenantId."
      );

    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && userData.subscription);

    if (!isMaster && !isSuperAdmin) {
      if (!permSnap.exists || !permSnap.data()?.canEdit) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Sem permissão."
        );
      }
    }

    try {
      await db.runTransaction(async (t) => {
        // 2. Fetch Transaction
        const ref = db.collection(COLLECTION_NAME).doc(transactionId);
        const snap = await t.get(ref);
        if (!snap.exists)
          throw new functions.https.HttpsError(
            "not-found",
            "Transação não encontrada."
          );

        const currentData = snap.data() as TransactionDoc;
        // Super admin can update any transaction
        if (!isSuperAdmin && currentData.tenantId !== tenantId)
          throw new functions.https.HttpsError(
            "permission-denied",
            "Acesso negado."
          );

        // 3. Logic for Wallet Balance Adjustment
        // Calculate old impact
        let oldImpact = 0;
        if (currentData.status === "paid" && currentData.wallet) {
          oldImpact =
            (currentData.type === "income" ? 1 : -1) *
            (currentData.amount || 0);
        }

        // Merge Data
        const newData = { ...currentData, ...updateData };

        // Calculate new impact
        let newImpact = 0;
        if (newData.status === "paid" && newData.wallet) {
          newImpact =
            (newData.type === "income" ? 1 : -1) * (newData.amount || 0);
        }

        // If impact changed, update wallets
        if (oldImpact !== newImpact || currentData.wallet !== newData.wallet) {
          // If wallet changed, we must reverse old and apply new separately
          if (currentData.wallet !== newData.wallet) {
            // Reverse old
            if (oldImpact !== 0 && currentData.wallet) {
              const wInfo = await resolveWalletRef(
                t,
                db,
                tenantId || "",
                currentData.wallet
              );
              if (wInfo)
                t.update(wInfo.ref, {
                  balance: FieldValue.increment(-oldImpact),
                  updatedAt: Timestamp.now(),
                });
            }
            // Apply new
            if (newImpact !== 0 && newData.wallet) {
              const wInfo = await resolveWalletRef(
                t,
                db,
                tenantId || "",
                newData.wallet
              );
              if (wInfo)
                t.update(wInfo.ref, {
                  balance: FieldValue.increment(newImpact),
                  updatedAt: Timestamp.now(),
                });
            }
          } else {
            // Same wallet, just diff
            const diff = newImpact - oldImpact;
            if (diff !== 0 && newData.wallet) {
              const wInfo = await resolveWalletRef(
                t,
                db,
                tenantId || "",
                newData.wallet
              );
              if (wInfo)
                t.update(wInfo.ref, {
                  balance: FieldValue.increment(diff),
                  updatedAt: Timestamp.now(),
                });
            }
          }
        }

        // 4. Update Document
        t.update(ref, {
          ...updateData,
          updatedAt: Timestamp.now(),
        });
      });

      return { success: true, message: "Atualizado com sucesso." };
    } catch (error) {
      console.error("Update Transaction Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });

// ============================================
// DELETE TRANSACTION (Atomic)
// ============================================
export const deleteTransaction = functions
  .region("southamerica-east1")
  .https.onCall(async (data: DeleteTransactionInput, context) => {
    // const db = getFirestore();
    if (!context.auth)
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    const userId = context.auth.uid;

    // 2. Parallel Fetch (User & Permission)
    const userRef = db.collection("users").doc(userId);
    const permRef = userRef.collection("permissions").doc("financial");

    const [userSnap, permSnap] = await Promise.all([
      userRef.get(),
      permRef.get(),
    ]);

    if (!userSnap.exists)
      throw new functions.https.HttpsError("not-found", "User not found");

    const userData = userSnap.data() as UserDoc;
    const tenantId = userData.tenantId || userData.companyId;
    const isSuperAdmin = (userData.role as string)?.toLowerCase() === "superadmin";

    if (!tenantId && !isSuperAdmin)
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Usuário sem tenantId."
      );

    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && userData.subscription);

    if (!isMaster && !isSuperAdmin) {
      if (!permSnap.exists || !permSnap.data()?.canDelete) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Sem permissão."
        );
      }
    }

    try {
      await db.runTransaction(async (t) => {
        // 2. Fetch Transaction
        const ref = db.collection(COLLECTION_NAME).doc(data.transactionId);
        const snap = await t.get(ref);
        if (!snap.exists)
          throw new functions.https.HttpsError(
            "not-found",
            "Transação não encontrada."
          );

        const currentData = snap.data() as TransactionDoc;
        // Super admin can delete any transaction
        if (!isSuperAdmin && currentData.tenantId !== tenantId)
          throw new functions.https.HttpsError(
            "permission-denied",
            "Acesso negado."
          );

        // 3. Revert Wallet Balance if needed
        if (currentData.status === "paid" && currentData.wallet) {
          const impact =
            (currentData.type === "income" ? 1 : -1) *
            (currentData.amount || 0);
          const wInfo = await resolveWalletRef(
            t,
            db,
            tenantId || "",
            currentData.wallet
          );
          if (wInfo) {
            t.update(wInfo.ref, {
              balance: FieldValue.increment(-impact),
              updatedAt: Timestamp.now(),
            });
          }
        }

        // 4. Delete
        t.delete(ref);
      });

      return { success: true, message: "Excluído com sucesso." };
    } catch (error) {
      console.error("Delete Transaction Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });
