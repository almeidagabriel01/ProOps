import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { checkFinancialPermission } from "../../lib/finance-helpers";
import {
  enforceTenantPlanLimit,
  getTenantWalletsUsage,
} from "../../lib/tenant-plan-policy";
import { z } from "zod";
import { sanitizeText, sanitizeRichText } from "../../utils/sanitize";

const CreateWalletSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório.").max(100).trim(),
  type: z.string().min(1, "Tipo é obrigatório.").max(50).trim(),
  color: z.string().min(1, "Cor é obrigatória.").max(20).trim(),
  icon: z.string().max(50).trim().optional().nullable(),
  description: z.string().max(500).trim().optional().nullable(),
  isDefault: z.boolean().optional(),
  initialBalance: z.number().optional(),
  targetTenantId: z.string().max(100).optional(),
});

const UpdateWalletSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  type: z.string().max(50).trim().optional(),
  color: z.string().max(20).trim().optional(),
  icon: z.string().max(50).trim().optional().nullable(),
  description: z.string().max(500).trim().optional().nullable(),
  isDefault: z.boolean().optional(),
  status: z.string().max(20).optional(),
});

const WALLETS_COLLECTION = "wallets";
const WALLET_TRANSACTIONS_COLLECTION = "wallet_transactions";

function mapWalletErrorStatus(message: string): number {
  if (
    message.startsWith("FORBIDDEN_") ||
    message.startsWith("AUTH_CLAIMS_MISSING_") ||
    message.includes("Sem permiss") ||
    message.includes("Acesso negado")
  ) {
    return 403;
  }
  if (message.includes("não encontrada")) return 404;
  if (message.includes("Dados inválidos")) return 400;
  return 500;
}

// Create Wallet
export const createWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;

    const parseResult = CreateWalletSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Nome, tipo e cor são obrigatórios.";
      return res.status(400).json({ message: firstError });
    }
    const data = req.body;

    // Sanitize text fields
    if (typeof data.name === "string") data.name = sanitizeText(data.name);
    if (typeof data.description === "string") data.description = sanitizeRichText(data.description);

    const { tenantId: userTenantId, isSuperAdmin } =
      await checkFinancialPermission(userId, "canCreate", req.user);

    // Super admin can specify target tenant
    const tenantId =
      data.targetTenantId && isSuperAdmin ? data.targetTenantId : userTenantId;
    const walletsUsage = await getTenantWalletsUsage(tenantId);
    const walletLimitDecision = await enforceTenantPlanLimit({
      tenantId,
      feature: "maxWallets",
      currentUsage: walletsUsage,
      uid: userId,
      requestId: req.requestId,
      route: req.path,
      isSuperAdmin,
    });
    if (!walletLimitDecision.allowed) {
      return res.status(walletLimitDecision.statusCode || 402).json({
        message:
          walletLimitDecision.message ||
          "Limite de carteiras atingido para o plano atual.",
        code: walletLimitDecision.code || "PLAN_LIMIT_EXCEEDED",
      });
    }

    const now = Timestamp.now();
    const initialBalance = data.initialBalance || 0;

    // Enforce unique wallet names per tenant
    const existingByName = await db
      .collection(WALLETS_COLLECTION)
      .where("tenantId", "==", tenantId)
      .where("name", "==", data.name.trim())
      .limit(1)
      .get();
    if (!existingByName.empty) {
      return res
        .status(400)
        .json({ message: "Já existe uma carteira com este nome." });
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

    let walletRefId: string;
    if (data.isDefault) {
      await db.runTransaction(async (t) => {
        const defaults = await db
          .collection(WALLETS_COLLECTION)
          .where("tenantId", "==", tenantId)
          .where("isDefault", "==", true)
          .get();
        defaults.docs.forEach((d) =>
          t.update(d.ref, { isDefault: false, updatedAt: now }),
        );
        const newRef = db.collection(WALLETS_COLLECTION).doc();
        walletRefId = newRef.id;
        t.set(newRef, walletData);
      });
    } else {
      const addedRef = await db.collection(WALLETS_COLLECTION).add(walletData);
      walletRefId = addedRef.id;
    }

    const walletRef = db.collection(WALLETS_COLLECTION).doc(walletRefId!);

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
    return res.status(mapWalletErrorStatus(message)).json({ message });
  }
};

export const updateWallet = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    const parseResult = UpdateWalletSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Dados inválidos.";
      return res.status(400).json({ message: firstError });
    }
    const updateData = req.body;

    // Sanitize text fields
    if (typeof updateData.name === "string") updateData.name = sanitizeText(updateData.name);
    if (typeof updateData.description === "string") updateData.description = sanitizeRichText(updateData.description);

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      req.user,
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

    // Enforce unique wallet names per tenant on rename
    if (
      typeof safeUpdate.name === "string" &&
      safeUpdate.name !== walletData?.name
    ) {
      const existingByName = await db
        .collection(WALLETS_COLLECTION)
        .where("tenantId", "==", tenantId)
        .where("name", "==", safeUpdate.name)
        .limit(1)
        .get();
      if (!existingByName.empty) {
        return res
          .status(400)
          .json({ message: "Já existe uma carteira com este nome." });
      }
    }

    if (updateData.isDefault) {
      await db.runTransaction(async (t) => {
        const defaults = await db
          .collection(WALLETS_COLLECTION)
          .where("tenantId", "==", tenantId)
          .where("isDefault", "==", true)
          .get();
        defaults.docs.forEach((d) => {
          if (d.id !== id) t.update(d.ref, { isDefault: false, updatedAt: now });
        });
        t.update(walletRef, safeUpdate);
      });
    } else {
      await walletRef.update(safeUpdate);
    }
    return res.json({ success: true, message: "Carteira atualizada." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(mapWalletErrorStatus(message)).json({ message });
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
      req.user,
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

    // Delete wallet_transactions in paginated batches (Firestore batch limit is 500)
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    do {
      let query = db
        .collection(WALLET_TRANSACTIONS_COLLECTION)
        .where("walletId", "==", id)
        .limit(400);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snap = await query.get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < 400) break;
    } while (true);

    await walletRef.delete();

    return res.json({ success: true, message: "Carteira excluída." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(mapWalletErrorStatus(message)).json({ message });
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
      req.user,
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
        tenantId: fromData?.tenantId, // Use wallet's tenantId
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
        tenantId: toData?.tenantId, // Use wallet's tenantId
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
    return res.status(mapWalletErrorStatus(message)).json({ message });
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
      req.user,
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
        tenantId: walletData?.tenantId, // Use wallet's tenantId, not user's
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
    return res.status(mapWalletErrorStatus(message)).json({ message });
  }
};
