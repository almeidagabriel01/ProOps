import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { checkFinancialPermission } from "../../lib/finance-helpers";
import { SyncService } from "../services/sync.service";

const CONNECTED_ACCOUNTS_COLLECTION = "connected_accounts";

// Create Connected Account
export const createConnectedAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const data = req.body;

    if (!data.provider || !data.providerItemId) {
      return res
        .status(400)
        .json({ message: "Provider e ProviderItemId são obrigatórios." });
    }

    const { tenantId: userTenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canCreate", // Assuming financial create permission matches
      req.user
    );
    
    // Super admin can specify target tenant
    const tenantId = data.targetTenantId && isSuperAdmin ? data.targetTenantId : userTenantId;
    const now = Timestamp.now();

    const accountData = {
      tenantId,
      provider: data.provider,
      providerItemId: data.providerItemId,
      accessToken: data.accessToken || null, // Store securely! In prod use Secret Manager/KMS
      bankName: data.bankName || null,
      bankImageUrl: data.bankImageUrl || null,
      status: "active",
      lastSyncAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await db.collection(CONNECTED_ACCOUNTS_COLLECTION).add(accountData);

    return res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Conta conectada registrada.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro ao conectar conta.";
    return res.status(500).json({ message });
  }
};

export const updateConnectedAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      req.user
    );
    const docRef = db.collection(CONNECTED_ACCOUNTS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists)
      return res.status(404).json({ message: "Conta conectada não encontrada." });
    const docData = docSnap.data();

    if (!isSuperAdmin && docData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const now = Timestamp.now();
    const safeUpdate: Record<string, unknown> = { updatedAt: now };
    
    // Allow updating specific fields
    const fields = [
      "status",
      "accessToken",
      "lastSyncAt",
      "providerItemId",
      "bankName",
      "bankImageUrl"
    ]; // Be careful with what can be updated

    fields.forEach((f) => {
      if (updateData[f] !== undefined) safeUpdate[f] = updateData[f];
    });

    await docRef.update(safeUpdate);
    return res.json({ success: true, message: "Conta conectada atualizada." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const deleteConnectedAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canDelete",
      req.user
    );
    const docRef = db.collection(CONNECTED_ACCOUNTS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists)
      return res.status(404).json({ message: "Conta conectada não encontrada." });
    const docData = docSnap.data();

    if (!isSuperAdmin && docData?.tenantId !== tenantId)
      return res.status(403).json({ message: "Acesso negado." });

    // TODO: Might want to check if wallets are linked before deleting?
    // For now, doing a soft delete or just delete.
    
    await docRef.delete();

    return res.json({ success: true, message: "Conta conectada removida." });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};



export const syncAccount = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      req.user
    );
    const docRef = db.collection(CONNECTED_ACCOUNTS_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists)
      return res.status(404).json({ message: "Conta conectada não encontrada." });
    const docData = docSnap.data();

    if (!isSuperAdmin && docData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    // Call shared Sync Service
    const importedCount = await SyncService.syncAccountTransactions(id, userId);

    return res.json({
      success: true,
      importedCount,
      message: `${importedCount} transações importadas.`,
    });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message =
      error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

