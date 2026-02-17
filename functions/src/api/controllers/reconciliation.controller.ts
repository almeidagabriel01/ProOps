
import { Request, Response } from "express";
import { db } from "../../init";
import { Timestamp } from "firebase-admin/firestore";
import { checkFinancialPermission } from "../../lib/finance-helpers";

const RULES_COLLECTION = "reconciliation_rules";

export const getReconciliationRules = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { tenantId } = await checkFinancialPermission(userId, "canView", req.user);

    const snapshot = await db.collection(RULES_COLLECTION)
      .where("tenantId", "==", tenantId)
      .get();

    const rules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(rules);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const createReconciliationRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const data = req.body;

    if (!data.keyword || !data.targetCategory) {
      return res.status(400).json({ message: "Palavra-chave e categoria são obrigatórias." });
    }

    const { tenantId } = await checkFinancialPermission(userId, "canCreate", req.user);
    const now = Timestamp.now();

    const newRule = {
      tenantId,
      keyword: data.keyword,
      targetCategory: data.targetCategory,
      targetType: data.targetType || "expense", // Default to expense
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    };

    const docRef = await db.collection(RULES_COLLECTION).add(newRule);

    return res.status(201).json({
      success: true,
      id: docRef.id,
      message: "Regra criada com sucesso.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const updateReconciliationRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(userId, "canEdit", req.user);
    
    const docRef = db.collection(RULES_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Regra não encontrada." });
    }

    const docData = docSnap.data();
    if (!isSuperAdmin && docData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const now = Timestamp.now();
    const safeUpdate: Record<string, unknown> = { updatedAt: now };
    
    const allowedFields = ["keyword", "targetCategory", "targetType", "isActive"];
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        safeUpdate[field] = updateData[field];
      }
    });

    await docRef.update(safeUpdate);

    return res.json({ success: true, message: "Regra atualizada." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};

export const deleteReconciliationRule = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(userId, "canDelete", req.user);

    const docRef = db.collection(RULES_COLLECTION).doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({ message: "Regra não encontrada." });
    }

    const docData = docSnap.data();
    if (!isSuperAdmin && docData?.tenantId !== tenantId) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    await docRef.delete();

    return res.json({ success: true, message: "Regra removida." });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return res.status(500).json({ message });
  }
};
