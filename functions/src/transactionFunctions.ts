/**
 * Cloud Functions: Transaction Management
 *
 * Secure CRUD operations for financial transactions with:
 * - Authentication verification
 * - Permission checks (MASTER or MEMBER with 'financial' page access)
 * - Tenant isolation
 * - Plan limit enforcement (future: maxTransactions)
 */

import * as functions from "firebase-functions";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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
  wallet?: string;
  isInstallment?: boolean;
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

const COLLECTION_NAME = "transactions";

// ============================================
// HELPER: Check Permission
// ============================================

async function checkFinancialPermission(
  db: FirebaseFirestore.Firestore,
  userId: string,
  requiredPermission: "canView" | "canCreate" | "canEdit" | "canDelete"
): Promise<{ tenantId: string; isMaster: boolean }> {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();

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
    Boolean(!userData.masterId && userData.subscription);

  if (!isMaster) {
    const permRef = userRef.collection("permissions").doc("financial");
    const permSnap = await permRef.get();
    if (!permSnap.exists || !permSnap.data()?.[requiredPermission]) {
      throw new functions.https.HttpsError(
        "permission-denied",
        `Sem permissão para ${requiredPermission} transações financeiras.`
      );
    }
  }

  return { tenantId, isMaster };
}

// ============================================
// HELPER: Update Wallet Balance
// ============================================

/**
 * Finds a wallet by name and updates its balance
 * @param db Firestore instance
 * @param tenantId Tenant ID for filtering
 * @param walletName Name of the wallet to update
 * @param amount Amount to add (positive) or subtract (negative)
 * @returns true if wallet was found and updated, false otherwise
 */
async function updateWalletBalance(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  walletName: string,
  amount: number
): Promise<boolean> {
  try {
    // Find wallet by name and tenantId
    const walletsQuery = await db
      .collection("wallets")
      .where("tenantId", "==", tenantId)
      .where("name", "==", walletName)
      .limit(1)
      .get();

    if (walletsQuery.empty) {
      console.log(`Wallet "${walletName}" not found for tenant ${tenantId}`);
      return false;
    }

    const walletDoc = walletsQuery.docs[0];
    const walletData = walletDoc.data();
    const newBalance = (walletData.balance || 0) + amount;

    await walletDoc.ref.update({
      balance: newBalance,
      updatedAt: Timestamp.now(),
    });

    console.log(
      `Wallet "${walletName}" balance updated: ${walletData.balance} -> ${newBalance} (${amount > 0 ? "+" : ""}${amount})`
    );
    return true;
  } catch (error) {
    console.error("Error updating wallet balance:", error);
    return false;
  }
}

/**
 * Calculate the balance adjustment based on transaction type and status change
 * @returns The amount to add to wallet (positive for income, negative for expense)
 */
function calculateBalanceAdjustment(
  type: TransactionType,
  amount: number,
  isPaying: boolean // true = becoming paid, false = becoming unpaid
): number {
  const sign = type === "income" ? 1 : -1;
  return isPaying ? sign * amount : -sign * amount;
}

// ============================================
// CREATE TRANSACTION
// ============================================

export const createTransaction = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CreateTransactionInput, context) => {
    const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const { tenantId } = await checkFinancialPermission(
      db,
      userId,
      "canCreate"
    );

    // Validate required fields
    if (
      !data.description ||
      !data.amount ||
      !data.date ||
      !data.type ||
      !data.status
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Campos obrigatórios: description, amount, date, type, status."
      );
    }

    const now = Timestamp.now();

    // Build transaction data (only defined fields)
    const transactionData: Record<string, unknown> = {
      tenantId,
      type: data.type,
      description: data.description.trim(),
      amount: data.amount,
      date: data.date,
      status: data.status,
      createdAt: now,
      updatedAt: now,
      createdById: userId,
    };

    // Optional fields
    if (data.dueDate) transactionData.dueDate = data.dueDate;
    if (data.clientId) transactionData.clientId = data.clientId;
    if (data.clientName) transactionData.clientName = data.clientName;
    if (data.proposalId) transactionData.proposalId = data.proposalId;
    if (data.category) transactionData.category = data.category;
    if (data.wallet) transactionData.wallet = data.wallet;
    if (data.isInstallment !== undefined)
      transactionData.isInstallment = data.isInstallment;
    if (data.installmentCount)
      transactionData.installmentCount = data.installmentCount;
    if (data.installmentNumber)
      transactionData.installmentNumber = data.installmentNumber;
    if (data.installmentGroupId)
      transactionData.installmentGroupId = data.installmentGroupId;
    if (data.notes) transactionData.notes = data.notes;

    try {
      const docRef = await db.collection(COLLECTION_NAME).add(transactionData);

      // If transaction is paid and has a wallet, update wallet balance
      if (data.status === "paid" && data.wallet) {
        const adjustment = calculateBalanceAdjustment(
          data.type,
          data.amount,
          true
        );
        await updateWalletBalance(db, tenantId, data.wallet, adjustment);
      }

      return {
        success: true,
        transactionId: docRef.id,
        message: "Transação criada com sucesso.",
      };
    } catch (error) {
      console.error("Create Transaction Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });

// ============================================
// UPDATE TRANSACTION
// ============================================

export const updateTransaction = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateTransactionInput, context) => {
    const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const { transactionId, ...updateData } = data;

    if (!transactionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID da transação inválido."
      );
    }

    const { tenantId } = await checkFinancialPermission(db, userId, "canEdit");

    // Verify transaction exists and belongs to tenant
    const transactionRef = db.collection(COLLECTION_NAME).doc(transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Transação não encontrada."
      );
    }

    const existingData = transactionSnap.data();
    if (existingData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Esta transação não pertence a sua organização."
      );
    }

    // Build safe update object
    const safeUpdate: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (updateData.type !== undefined) safeUpdate.type = updateData.type;
    if (updateData.description !== undefined)
      safeUpdate.description = updateData.description;
    if (updateData.amount !== undefined) safeUpdate.amount = updateData.amount;
    if (updateData.date !== undefined) safeUpdate.date = updateData.date;
    if (updateData.dueDate !== undefined)
      safeUpdate.dueDate = updateData.dueDate;
    if (updateData.status !== undefined) safeUpdate.status = updateData.status;
    if (updateData.clientId !== undefined)
      safeUpdate.clientId = updateData.clientId;
    if (updateData.clientName !== undefined)
      safeUpdate.clientName = updateData.clientName;
    if (updateData.proposalId !== undefined)
      safeUpdate.proposalId = updateData.proposalId;
    if (updateData.category !== undefined)
      safeUpdate.category = updateData.category;
    if (updateData.wallet !== undefined) safeUpdate.wallet = updateData.wallet;
    if (updateData.isInstallment !== undefined)
      safeUpdate.isInstallment = updateData.isInstallment;
    if (updateData.installmentCount !== undefined)
      safeUpdate.installmentCount = updateData.installmentCount;
    if (updateData.installmentNumber !== undefined)
      safeUpdate.installmentNumber = updateData.installmentNumber;
    if (updateData.installmentGroupId !== undefined)
      safeUpdate.installmentGroupId = updateData.installmentGroupId;
    if (updateData.notes !== undefined) safeUpdate.notes = updateData.notes;

    try {
      // Handle wallet balance sync when status changes
      const oldStatus = existingData?.status as TransactionStatus;
      const newStatus = updateData.status ?? oldStatus;
      const oldWallet = existingData?.wallet as string | undefined;
      const newWallet = updateData.wallet ?? oldWallet;
      const oldAmount = existingData?.amount as number;
      const newAmount = updateData.amount ?? oldAmount;
      const oldType = existingData?.type as TransactionType;
      const newType = updateData.type ?? oldType;

      // Case 1: Was paid with wallet, status changing to not paid - revert balance
      if (oldStatus === "paid" && newStatus !== "paid" && oldWallet) {
        const revertAdjustment = calculateBalanceAdjustment(
          oldType,
          oldAmount,
          false
        );
        await updateWalletBalance(db, tenantId, oldWallet, revertAdjustment);
      }
      // Case 2: Becoming paid with wallet - add to balance
      else if (oldStatus !== "paid" && newStatus === "paid" && newWallet) {
        const addAdjustment = calculateBalanceAdjustment(
          newType,
          newAmount,
          true
        );
        await updateWalletBalance(db, tenantId, newWallet, addAdjustment);
      }
      // Case 3: Was paid, still paid, but wallet or amount changed
      else if (oldStatus === "paid" && newStatus === "paid") {
        // If wallet changed, revert from old and add to new
        if (
          oldWallet !== newWallet ||
          oldAmount !== newAmount ||
          oldType !== newType
        ) {
          if (oldWallet) {
            const revertAdjustment = calculateBalanceAdjustment(
              oldType,
              oldAmount,
              false
            );
            await updateWalletBalance(
              db,
              tenantId,
              oldWallet,
              revertAdjustment
            );
          }
          if (newWallet) {
            const addAdjustment = calculateBalanceAdjustment(
              newType,
              newAmount,
              true
            );
            await updateWalletBalance(db, tenantId, newWallet, addAdjustment);
          }
        }
      }

      await transactionRef.update(safeUpdate);
      return { success: true, message: "Transação atualizada com sucesso." };
    } catch (error) {
      console.error("Update Transaction Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });

// ============================================
// DELETE TRANSACTION
// ============================================

export const deleteTransaction = functions
  .region("southamerica-east1")
  .https.onCall(async (data: DeleteTransactionInput, context) => {
    const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const { transactionId } = data;

    if (!transactionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID da transação inválido."
      );
    }

    const { tenantId } = await checkFinancialPermission(
      db,
      userId,
      "canDelete"
    );

    // Verify transaction exists and belongs to tenant
    const transactionRef = db.collection(COLLECTION_NAME).doc(transactionId);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Transação não encontrada."
      );
    }

    const existingData = transactionSnap.data();
    if (existingData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Esta transação não pertence a sua organização."
      );
    }

    try {
      // If transaction was paid with a wallet, revert the balance
      const status = existingData?.status as TransactionStatus;
      const wallet = existingData?.wallet as string | undefined;
      const amount = existingData?.amount as number;
      const type = existingData?.type as TransactionType;

      if (status === "paid" && wallet) {
        const revertAdjustment = calculateBalanceAdjustment(
          type,
          amount,
          false
        );
        await updateWalletBalance(db, tenantId, wallet, revertAdjustment);
      }

      await transactionRef.delete();
      return { success: true, message: "Transação excluída com sucesso." };
    } catch (error) {
      console.error("Delete Transaction Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });
