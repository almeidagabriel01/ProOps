import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { checkFinancialPermission } from "../../lib/finance-helpers";

const WALLETS_COLLECTION = "wallets";
const WALLET_TRANSACTIONS_COLLECTION = "wallet_transactions";

// Create Wallet
export const createWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const data = req.body;

    if (!data.name || !data.type || !data.color) {
      return res
        .status(400)
        .json({ message: "Nome, tipo e cor são obrigatórios." });
    }

    const { tenantId } = await checkFinancialPermission(
      userId,
      "canCreate",
      req.user
    );
    const now = Timestamp.now();
    const initialBalance = data.initialBalance || 0;

    if (data.isDefault) {
      const defaults = await db
        .collection(WALLETS_COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("isDefault", "==", true)
        .get();

      const batch = db.batch();
      defaults.docs.forEach((d) =>
        batch.update(d.ref, { isDefault: false, updatedAt: now })
      );
      if (!defaults.empty) await batch.commit();
    }

    const walletData = {
      tenantId,
      name: data.name.trim(),
      type: data.type,
      balance: initialBalance,
      color: data.color,
      icon: data.icon || null,
      description: data.description || null,
      isDefault: data.isDefault || false,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };

    const walletRef = await db.collection(WALLETS_COLLECTION).add(walletData);

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

    return res.status(201).json({
      success: true,
      walletId: walletRef.id,
      message: "Carteira criada.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao criar carteira.";
    return res.status(500).json({ message });
  }
};

export const updateWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      req.user
    );
    const walletRef = db.collection(WALLETS_COLLECTION).doc(id);
    const walletSnap = await walletRef.get();

    if (!walletSnap.exists)
      return res.status(404).json({ message: "Carteira não encontrada." });
    const walletData = walletSnap.data();

    if (!isSuperAdmin && walletData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const now = Timestamp.now();

    if (updateData.isDefault) {
      const defaults = await db
        .collection(WALLETS_COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("isDefault", "==", true)
        .get();

      const batch = db.batch();
      defaults.docs.forEach((d) => {
        if (d.id !== id)
          batch.update(d.ref, { isDefault: false, updatedAt: now });
      });
      if (!defaults.empty) await batch.commit();
    }

    const safeUpdate: Record<string, unknown> = { updatedAt: now };
    const fields = [
      "name",
      "type",
      "color",
      "icon",
      "description",
      "isDefault",
      "status",
    ];
    fields.forEach((f) => {
      if (updateData[f] !== undefined) safeUpdate[f] = updateData[f];
    });
    if (typeof safeUpdate.name === "string")
      safeUpdate.name = safeUpdate.name.trim();

    await walletRef.update(safeUpdate);
    return res.json({ success: true, message: "Carteira atualizada." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const deleteWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const { force } = req.query;

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canDelete",
      req.user
    );
    const walletRef = db.collection(WALLETS_COLLECTION).doc(id);
    const walletSnap = await walletRef.get();

    if (!walletSnap.exists)
      return res.status(404).json({ message: "Carteira não encontrada." });
    const walletData = walletSnap.data();

    if (!isSuperAdmin && walletData?.tenantId !== tenantId)
      return res.status(403).json({ message: "Acesso negado." });

    if (walletData?.balance !== 0 && force !== "true") {
      return res.status(412).json({
        message: `Não é possível excluir carteira com saldo (R$ ${walletData?.balance}).`,
      });
    }

    const transactions = await db
      .collection(WALLET_TRANSACTIONS_COLLECTION)
      .where("walletId", "==", id)
      .get();
    const batch = db.batch();
    transactions.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(walletRef);
    await batch.commit();

    return res.json({ success: true, message: "Carteira excluída." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const transferValues = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { fromWalletId, toWalletId, amount } = req.body;

    if (!fromWalletId || !toWalletId || !amount || amount <= 0) {
      return res.status(400).json({ message: "Dados inválidos." });
    }
    if (fromWalletId === toWalletId)
      return res.status(400).json({ message: "Mesma carteira." });

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      req.user
    );

    await db.runTransaction(async (t) => {
      const fromRef = db.collection(WALLETS_COLLECTION).doc(fromWalletId);
      const toRef = db.collection(WALLETS_COLLECTION).doc(toWalletId);

      const [fromDoc, toDoc] = await Promise.all([
        t.get(fromRef),
        t.get(toRef),
      ]);

      if (!fromDoc.exists || !toDoc.exists)
        throw new Error("Carteira não encontrada.");

      const fromData = fromDoc.data();
      const toData = toDoc.data();

      if (
        !isSuperAdmin &&
        (fromData?.tenantId !== tenantId || toData?.tenantId !== tenantId)
      ) {
        throw new Error("Acesso negado.");
      }

      if ((fromData?.balance || 0) < amount)
        throw new Error("Saldo insuficiente.");

      const now = Timestamp.now();
      const newFrom = (fromData?.balance || 0) - amount;
      const newTo = (toData?.balance || 0) + amount;

      t.update(fromRef, { balance: newFrom, updatedAt: now });
      t.update(toRef, { balance: newTo, updatedAt: now });

      const txRef1 = db.collection(WALLET_TRANSACTIONS_COLLECTION).doc();
      t.set(txRef1, {
        tenantId,
        walletId: fromWalletId,
        type: "transfer_out",
        amount,
        description: `Transferência para ${toData?.name}`,
        relatedWalletId: toWalletId,
        balanceAfter: newFrom,
        createdAt: now,
        createdBy: userId,
      });

      const txRef2 = db.collection(WALLET_TRANSACTIONS_COLLECTION).doc();
      t.set(txRef2, {
        tenantId,
        walletId: toWalletId,
        type: "transfer_in",
        amount,
        description: `Transferência de ${fromData?.name}`,
        relatedWalletId: fromWalletId,
        balanceAfter: newTo,
        createdAt: now,
        createdBy: userId,
      });
    });

    return res.json({ success: true, message: "Transferência realizada." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const adjustBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { walletId, amount, description } = req.body;

    if (!walletId || !amount || !description)
      return res.status(400).json({ message: "Dados incompletos." });

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      req.user
    );

    const result = await db.runTransaction(async (t) => {
      const walletRef = db.collection(WALLETS_COLLECTION).doc(walletId);
      const walletDoc = await t.get(walletRef);

      if (!walletDoc.exists) throw new Error("Carteira não encontrada.");
      const walletData = walletDoc.data();

      if (!isSuperAdmin && walletData?.tenantId !== tenantId)
        throw new Error("Acesso negado.");

      const current = walletData?.balance || 0;
      const newBalance = current + amount;

      if (newBalance < 0) throw new Error("Saldo insuficiente para o ajuste.");

      const now = Timestamp.now();
      t.update(walletRef, { balance: newBalance, updatedAt: now });

      const txRef = db.collection(WALLET_TRANSACTIONS_COLLECTION).doc();
      t.set(txRef, {
        tenantId,
        walletId,
        type: amount > 0 ? "deposit" : "withdrawal",
        amount: Math.abs(amount),
        description: description.trim(),
        balanceAfter: newBalance,
        createdAt: now,
        createdBy: userId,
      });

      return newBalance;
    });

    return res.json({
      success: true,
      newBalance: result,
      message: "Saldo ajustado.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};
