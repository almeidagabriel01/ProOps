/**
 * Cloud Functions: Wallet Management
 *
 * Secure CRUD operations for financial wallets with:
 * - Authentication verification
 * - Permission checks (MASTER or MEMBER with 'financial' page access)
 * - Tenant isolation
 * - Balance tracking with transaction history
 */

import * as functions from "firebase-functions";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "./init";

// ============================================
// TYPES
// ============================================

type WalletType = "bank" | "cash" | "digital" | "credit_card" | "other";
type WalletStatus = "active" | "archived";

interface CreateWalletInput {
  name: string;
  type: WalletType;
  initialBalance?: number;
  color: string;
  icon?: string;
  description?: string;
  isDefault?: boolean;
}

interface UpdateWalletInput {
  walletId: string;
  name?: string;
  type?: WalletType;
  color?: string;
  icon?: string;
  description?: string;
  isDefault?: boolean;
  status?: WalletStatus;
}

interface DeleteWalletInput {
  walletId: string;
  force?: boolean; // Force delete even if balance > 0
}

interface TransferInput {
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  description?: string;
}

interface AdjustBalanceInput {
  walletId: string;
  amount: number; // Positive = add, Negative = remove
  description: string;
}

interface UserDoc {
  role: "MASTER" | "MEMBER";
  masterId: string | null;
  tenantId: string;
  companyId?: string;
  subscription?: { status: string };
  status: string;
}

const WALLETS_COLLECTION = "wallets";
const WALLET_TRANSACTIONS_COLLECTION = "wallet_transactions";

// ============================================
// HELPER: Check Financial Permission
// ============================================

async function checkFinancialPermission(
  db: FirebaseFirestore.Firestore,
  userId: string,
  requiredPermission: "canView" | "canCreate" | "canEdit" | "canDelete"
): Promise<{ tenantId: string; isMaster: boolean }> {
  const userRef = db.collection("users").doc(userId);
  const permRef = userRef.collection("permissions").doc("financial");

  // Parallel Fetch
  const [userDoc, permDoc] = await Promise.all([userRef.get(), permRef.get()]);

  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Usuário não encontrado."
    );
  }

  const userData = userDoc.data() as UserDoc;

  // Normalize role to uppercase for comparison
  const role = (userData.role as string)?.toUpperCase();

  // Determine tenant ID
  const tenantId = userData.tenantId || userData.companyId;
  if (!tenantId) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Usuário não está associado a nenhuma empresa."
    );
  }

  const isMaster =
    role === "MASTER" ||
    role === "ADMIN" ||
    role === "WK" ||
    (!userData.masterId && userData.subscription);

  // MASTER or ADMIN role: Full access
  if (isMaster) {
    return { tenantId, isMaster: true };
  }

  // MEMBER role: Check page permissions
  if (role === "MEMBER") {
    if (!permDoc.exists) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Sem permissão para acessar o módulo financeiro."
      );
    }

    const perms = permDoc.data();
    if (!perms || !perms[requiredPermission]) {
      throw new functions.https.HttpsError(
        "permission-denied",
        `Sem permissão para ${requiredPermission === "canView" ? "visualizar" : requiredPermission === "canCreate" ? "criar" : requiredPermission === "canEdit" ? "editar" : "excluir"} carteiras.`
      );
    }

    return { tenantId, isMaster: false };
  }

  throw new functions.https.HttpsError("permission-denied", "Acesso negado.");
}

// ============================================
// CREATE WALLET
// ============================================

export const createWallet = functions
  .region("southamerica-east1")
  .https.onCall(async (data: CreateWalletInput, context) => {
    // const db = getFirestore();

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
    if (!data.name || data.name.trim().length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Nome da carteira é obrigatório."
      );
    }

    if (!data.type) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Tipo da carteira é obrigatório."
      );
    }

    if (!data.color) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Cor da carteira é obrigatória."
      );
    }

    const now = Timestamp.now();
    const initialBalance = data.initialBalance || 0;

    // If setting as default, unset other defaults
    if (data.isDefault) {
      const existingDefaults = await db
        .collection(WALLETS_COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("isDefault", "==", true)
        .get();

      const batch = db.batch();
      existingDefaults.docs.forEach((doc) => {
        batch.update(doc.ref, { isDefault: false, updatedAt: now });
      });

      if (!existingDefaults.empty) {
        await batch.commit();
      }
    }

    // Create wallet
    const walletData = {
      tenantId,
      name: data.name.trim(),
      type: data.type,
      balance: initialBalance,
      color: data.color,
      icon: data.icon || null,
      description: data.description || null,
      isDefault: data.isDefault || false,
      status: "active" as WalletStatus,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const walletRef = await db.collection(WALLETS_COLLECTION).add(walletData);

      // If there's initial balance, create a transaction record
      if (initialBalance !== 0) {
        await db.collection(WALLET_TRANSACTIONS_COLLECTION).add({
          tenantId,
          walletId: walletRef.id,
          type: initialBalance > 0 ? "deposit" : "withdrawal",
          amount: Math.abs(initialBalance),
          description: "Saldo inicial",
          balanceAfter: initialBalance,
          createdAt: now,
          createdBy: userId,
        });
      }

      return {
        success: true,
        walletId: walletRef.id,
        message: "Carteira criada com sucesso.",
      };
    } catch (error) {
      console.error("Create Wallet Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });

// ============================================
// UPDATE WALLET
// ============================================

export const updateWallet = functions
  .region("southamerica-east1")
  .https.onCall(async (data: UpdateWalletInput, context) => {
    // const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const { walletId, ...updateData } = data;

    if (!walletId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID da carteira é obrigatório."
      );
    }

    // Parallel Fetch (Permission & Wallet)
    const walletRef = db.collection(WALLETS_COLLECTION).doc(walletId);

    const [permResult, walletDoc] = await Promise.all([
      checkFinancialPermission(db, userId, "canEdit"),
      walletRef.get(),
    ]);
    const { tenantId } = permResult;

    if (!walletDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Carteira não encontrada."
      );
    }

    const walletData = walletDoc.data();
    if (walletData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Sem permissão para editar esta carteira."
      );
    }

    const now = Timestamp.now();

    // If setting as default, unset other defaults
    if (updateData.isDefault === true) {
      const existingDefaults = await db
        .collection(WALLETS_COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("isDefault", "==", true)
        .get();

      const batch = db.batch();
      existingDefaults.docs.forEach((doc) => {
        if (doc.id !== walletId) {
          batch.update(doc.ref, { isDefault: false, updatedAt: now });
        }
      });

      if (!existingDefaults.empty) {
        await batch.commit();
      }
    }

    // Build safe update object
    const safeUpdate: Record<string, unknown> = { updatedAt: now };

    if (updateData.name !== undefined) safeUpdate.name = updateData.name.trim();
    if (updateData.type !== undefined) safeUpdate.type = updateData.type;
    if (updateData.color !== undefined) safeUpdate.color = updateData.color;
    if (updateData.icon !== undefined) safeUpdate.icon = updateData.icon;
    if (updateData.description !== undefined)
      safeUpdate.description = updateData.description;
    if (updateData.isDefault !== undefined)
      safeUpdate.isDefault = updateData.isDefault;
    if (updateData.status !== undefined) safeUpdate.status = updateData.status;

    try {
      await walletRef.update(safeUpdate);
      return { success: true, message: "Carteira atualizada com sucesso." };
    } catch (error) {
      console.error("Update Wallet Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });

// ============================================
// DELETE WALLET
// ============================================

export const deleteWallet = functions
  .region("southamerica-east1")
  .https.onCall(async (data: DeleteWalletInput, context) => {
    // const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const { walletId, force = false } = data;

    if (!walletId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID da carteira é obrigatório."
      );
    }

    // Parallel Fetch
    const walletRef = db.collection(WALLETS_COLLECTION).doc(walletId);

    const [permResult, walletDoc] = await Promise.all([
      checkFinancialPermission(db, userId, "canDelete"),
      walletRef.get(),
    ]);
    const { tenantId } = permResult;

    if (!walletDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Carteira não encontrada."
      );
    }

    const walletData = walletDoc.data();
    if (walletData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Sem permissão para excluir esta carteira."
      );
    }

    // Check balance
    if (!force && walletData?.balance !== 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Não é possível excluir carteira com saldo (R$ ${walletData?.balance?.toFixed(2)}). Transfira o saldo para outra carteira primeiro.`
      );
    }

    try {
      // Delete wallet transactions first
      const transactions = await db
        .collection(WALLET_TRANSACTIONS_COLLECTION)
        .where("walletId", "==", walletId)
        .get();

      const batch = db.batch();
      transactions.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      batch.delete(walletRef);

      await batch.commit();

      return { success: true, message: "Carteira excluída com sucesso." };
    } catch (error) {
      console.error("Delete Wallet Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });

// ============================================
// TRANSFER BETWEEN WALLETS
// ============================================

export const transferBetweenWallets = functions
  .region("southamerica-east1")
  .https.onCall(async (data: TransferInput, context) => {
    // const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const { fromWalletId, toWalletId, amount } = data;

    if (!fromWalletId || !toWalletId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Carteiras de origem e destino são obrigatórias."
      );
    }

    if (fromWalletId === toWalletId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Carteira de origem e destino não podem ser iguais."
      );
    }

    if (!amount || amount <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Valor da transferência deve ser maior que zero."
      );
    }

    // Parallel Fetch (Permission, From, To)
    const [permResult, fromDoc, toDoc] = await Promise.all([
      checkFinancialPermission(db, userId, "canEdit"),
      db.collection(WALLETS_COLLECTION).doc(fromWalletId).get(),
      db.collection(WALLETS_COLLECTION).doc(toWalletId).get(),
    ]);
    const { tenantId } = permResult;

    if (!fromDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Carteira de origem não encontrada."
      );
    }

    if (!toDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Carteira de destino não encontrada."
      );
    }

    const fromData = fromDoc.data();
    const toData = toDoc.data();

    // Verify tenant
    if (fromData?.tenantId !== tenantId || toData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Sem permissão para transferir entre estas carteiras."
      );
    }

    // Check sufficient balance
    if (fromData?.balance < amount) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Saldo insuficiente. Saldo atual: R$ ${fromData?.balance?.toFixed(2)}`
      );
    }

    const now = Timestamp.now();
    const newFromBalance = (fromData?.balance || 0) - amount;
    const newToBalance = (toData?.balance || 0) + amount;

    try {
      const batch = db.batch();

      // Update from wallet
      batch.update(fromDoc.ref, {
        balance: newFromBalance,
        updatedAt: now,
      });

      // Update to wallet
      batch.update(toDoc.ref, {
        balance: newToBalance,
        updatedAt: now,
      });

      // Create transaction record for from wallet
      const fromTransactionRef = db
        .collection(WALLET_TRANSACTIONS_COLLECTION)
        .doc();
      batch.set(fromTransactionRef, {
        tenantId,
        walletId: fromWalletId,
        type: "transfer_out",
        amount,
        description: `Transferência para ${toData?.name}`,
        relatedWalletId: toWalletId,
        balanceAfter: newFromBalance,
        createdAt: now,
        createdBy: userId,
      });

      // Create transaction record for to wallet
      const toTransactionRef = db
        .collection(WALLET_TRANSACTIONS_COLLECTION)
        .doc();
      batch.set(toTransactionRef, {
        tenantId,
        walletId: toWalletId,
        type: "transfer_in",
        amount,
        description: `Transferência de ${fromData?.name}`,
        relatedWalletId: fromWalletId,
        balanceAfter: newToBalance,
        createdAt: now,
        createdBy: userId,
      });

      await batch.commit();

      return {
        success: true,
        message: `Transferência de R$ ${amount.toFixed(2)} realizada com sucesso.`,
      };
    } catch (error) {
      console.error("Transfer Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });

// ============================================
// ADJUST WALLET BALANCE
// ============================================

export const adjustWalletBalance = functions
  .region("southamerica-east1")
  .https.onCall(async (data: AdjustBalanceInput, context) => {
    // const db = getFirestore();

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Login necessário."
      );
    }

    const userId = context.auth.uid;
    const { walletId, amount, description } = data;

    if (!walletId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "ID da carteira é obrigatório."
      );
    }

    if (amount === 0 || amount === undefined) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Valor do ajuste é obrigatório e não pode ser zero."
      );
    }

    if (!description || description.trim().length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Descrição do ajuste é obrigatória."
      );
    }

    // Parallel Fetch
    const walletRef = db.collection(WALLETS_COLLECTION).doc(walletId);

    const [permResult, walletDoc] = await Promise.all([
      checkFinancialPermission(db, userId, "canEdit"),
      walletRef.get(),
    ]);
    const { tenantId } = permResult;

    if (!walletDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Carteira não encontrada."
      );
    }

    const walletData = walletDoc.data();
    if (walletData?.tenantId !== tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Sem permissão para ajustar esta carteira."
      );
    }

    const currentBalance = walletData?.balance || 0;
    const newBalance = currentBalance + amount;

    // Prevent negative balance if withdrawal
    if (newBalance < 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Saldo insuficiente para este ajuste. Saldo atual: R$ ${currentBalance.toFixed(2)}`
      );
    }

    const now = Timestamp.now();

    try {
      const batch = db.batch();

      // Update wallet balance
      batch.update(walletRef, {
        balance: newBalance,
        updatedAt: now,
      });

      // Create transaction record
      const transactionRef = db
        .collection(WALLET_TRANSACTIONS_COLLECTION)
        .doc();
      batch.set(transactionRef, {
        tenantId,
        walletId,
        type: amount > 0 ? "deposit" : "withdrawal",
        amount: Math.abs(amount),
        description: description.trim(),
        balanceAfter: newBalance,
        createdAt: now,
        createdBy: userId,
      });

      await batch.commit();

      return {
        success: true,
        newBalance,
        message:
          amount > 0
            ? `R$ ${Math.abs(amount).toFixed(2)} adicionado com sucesso.`
            : `R$ ${Math.abs(amount).toFixed(2)} removido com sucesso.`,
      };
    } catch (error) {
      console.error("Adjust Balance Error:", error);
      throw new functions.https.HttpsError(
        "internal",
        (error as Error).message
      );
    }
  });
