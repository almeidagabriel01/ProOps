import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { sanitizeText } from "../../utils/sanitize";

const WALLETS_COLLECTION = "wallets";

// ===== Interfaces =====

export interface WalletListItem {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
}

export interface CreateWalletParams {
  name: string;
  type: string;
  color: string;
  description?: string;
  initialBalance?: number;
}

export interface TransferParams {
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  description?: string;
}

// ===== Service Functions =====

export async function listWallets(tenantId: string): Promise<WalletListItem[]> {
  const snap = await db
    .collection(WALLETS_COLLECTION)
    .where("tenantId", "==", tenantId)
    .where("status", "==", "active")
    .limit(50)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || "",
      type: data.type || "",
      balance: data.balance || 0,
      color: data.color || "",
    };
  });
}

export async function createWallet(
  params: CreateWalletParams,
  tenantId: string,
): Promise<{ id: string; name: string }> {
  const name = sanitizeText(params.name).trim();

  // Enforce unique wallet names per tenant
  const existingByName = await db
    .collection(WALLETS_COLLECTION)
    .where("tenantId", "==", tenantId)
    .where("name", "==", name)
    .limit(1)
    .get();

  if (!existingByName.empty) {
    throw new Error("Carteira com este nome ja existe.");
  }

  const now = Timestamp.now();
  const initialBalance = params.initialBalance || 0;

  const walletData = {
    tenantId,
    name,
    type: params.type,
    color: params.color,
    description: params.description || null,
    balance: initialBalance,
    isDefault: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const walletRef = await db.collection(WALLETS_COLLECTION).add(walletData);

  return { id: walletRef.id, name };
}

export async function transferBetweenWallets(
  params: TransferParams,
  tenantId: string,
): Promise<{ fromWallet: string; toWallet: string; amount: number }> {
  const { fromWalletId, toWalletId, amount } = params;

  if (fromWalletId === toWalletId) {
    throw new Error("Origem e destino da transferência não podem ser a mesma carteira.");
  }

  if (!amount || amount <= 0) {
    throw new Error("Valor da transferência deve ser maior que zero.");
  }

  const result = await db.runTransaction(async (t) => {
    const fromRef = db.collection(WALLETS_COLLECTION).doc(fromWalletId);
    const toRef = db.collection(WALLETS_COLLECTION).doc(toWalletId);

    const [fromSnap, toSnap] = await Promise.all([t.get(fromRef), t.get(toRef)]);

    if (!fromSnap.exists) {
      throw new Error("Carteira de origem não encontrada.");
    }
    if (!toSnap.exists) {
      throw new Error("Carteira de destino não encontrada.");
    }

    const fromData = fromSnap.data()!;
    const toData = toSnap.data()!;

    if (fromData.tenantId !== tenantId) {
      throw new Error("Carteira de origem não pertence a este tenant.");
    }
    if (toData.tenantId !== tenantId) {
      throw new Error("Carteira de destino não pertence a este tenant.");
    }

    if (fromData.status !== "active") {
      throw new Error("Carteira de origem está inativa.");
    }
    if (toData.status !== "active") {
      throw new Error("Carteira de destino está inativa.");
    }

    const fromBalance = fromData.balance || 0;
    if (fromBalance < amount) {
      throw new Error("Saldo insuficiente na carteira de origem.");
    }

    const now = Timestamp.now();

    t.update(fromRef, {
      balance: FieldValue.increment(-amount),
      updatedAt: now,
    });
    t.update(toRef, {
      balance: FieldValue.increment(amount),
      updatedAt: now,
    });

    return {
      fromWallet: fromData.name as string,
      toWallet: toData.name as string,
    };
  });

  return {
    fromWallet: result.fromWallet,
    toWallet: result.toWallet,
    amount,
  };
}
