import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { checkProposalLimit } from "../../lib/billing-helpers";
import {
  UserDoc,
  resolveUserAndTenant,
  checkPermission,
} from "../../lib/auth-helpers";

const PROPOSALS_COLLECTION = "proposals";

export const createProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const input = req.body;

    if (!input.title || input.title.trim().length < 3) {
      return res
        .status(400)
        .json({ message: "Título deve ter pelo menos 3 caracteres" });
    }
    if (!input.clientId || !input.clientName) {
      return res.status(400).json({ message: "Cliente é obrigatório" });
    }
    if (typeof input.totalValue !== "number" || input.totalValue < 0) {
      return res.status(400).json({ message: "Valor total inválido" });
    }

    const {
      masterData,
      masterRef,
      tenantId,
      isMaster,
      isSuperAdmin,
      userData,
    } = await resolveUserAndTenant(userId, req.user);

    if (!isMaster && !isSuperAdmin) {
      const canCreate = await checkPermission(userId, "proposals", "canCreate");
      if (!canCreate) {
        return res
          .status(403)
          .json({ message: "Sem permissão para criar propostas." });
      }
    }

    const userCompanyId =
      input.targetTenantId && isSuperAdmin ? input.targetTenantId : tenantId;

    // Adjust masterRef and masterData if Super Admin is acting on behalf of another tenant
    let targetMasterRef = masterRef;
    let targetMasterData = masterData;
    
    // We already resolved masterData for the logged user (Super Admin). 
    // If target is different, we must find the actual master of that tenant.
    if (isSuperAdmin && userCompanyId && userCompanyId !== tenantId) {
      const ownerQuery = await db.collection("users")
        .where("tenantId", "==", userCompanyId)
        .limit(10)
        .get();

      let ownerDoc = ownerQuery.docs.find(d => !d.data().masterId);
      if (!ownerDoc && !ownerQuery.empty) {
         ownerDoc = ownerQuery.docs.find(d => ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role));
         if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
      }

      if (ownerDoc) {
        targetMasterRef = db.collection("users").doc(ownerDoc.id);
        targetMasterData = ownerDoc.data() as UserDoc;
      }
    }

    if (
      targetMasterData.subscription?.status &&
      !["ACTIVE", "TRIALING"].includes(targetMasterData.subscription.status)
    ) {
      // Optional: check strict status
    }

    try {
      await checkProposalLimit(targetMasterData);
    } catch (e) {
      // Allow bypass for Super Admin
      if (!isSuperAdmin) {
        const error = e as Error;
        return res
          .status(402)
          .json({ message: error.message, code: "resource-exhausted" });
      }
    }

    const proposalId = await db.runTransaction(async (t) => {
      // === ALL READS FIRST ===
      const freshMasterSnap = await t.get(masterRef);
      const freshMasterData = freshMasterSnap.data() as UserDoc;

      const companyRef = db.collection("companies").doc(userCompanyId);
      const companySnap = await t.get(companyRef);

      // Validate limit after reads
      try {
        await checkProposalLimit(freshMasterData);
      } catch (e) {
        const error = e as Error;
        throw new Error(error.message);
      }

      // === ALL WRITES AFTER READS ===
      const newRef = db.collection(PROPOSALS_COLLECTION).doc();
      const now = Timestamp.now();

      t.set(newRef, {
        title: input.title.trim(),
        status: input.status || "draft",
        totalValue: input.totalValue,
        notes: input.notes?.trim() || null,
        customNotes: input.customNotes?.trim() || null,
        discount: input.discount || 0,
        validUntil: input.validUntil || null,
        clientId: input.clientId,
        clientName: input.clientName,
        clientEmail: input.clientEmail || null,
        clientPhone: input.clientPhone || null,
        clientAddress: input.clientAddress || null,
        products: input.products || [],
        sistemas: input.sistemas || [],
        sections: input.sections || [],
        createdById: userId,
        createdByName: userData?.name || "Usuário",
        companyId: userCompanyId,
        tenantId: userCompanyId,
        createdAt: now,
        updatedAt: now,
      });

      t.update(targetMasterRef, {
        "usage.proposals": FieldValue.increment(1),
        updatedAt: now,
      });

      if (companySnap.exists) {
        t.update(companyRef, {
          "usage.proposals": FieldValue.increment(1),
          updatedAt: now,
        });
      }

      return newRef.id;
    });

    return res.status(201).json({
      success: true,
      proposalId,
      message: "Proposta criada com sucesso!",
    });
  } catch (error: unknown) {
    console.error("createProposal Error:", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return res.status(500).json({ message });
  }
};

export const updateProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user
    );

    const proposalRef = db.collection(PROPOSALS_COLLECTION).doc(id);
    const proposalSnap = await proposalRef.get();

    if (!proposalSnap.exists)
      return res.status(404).json({ message: "Proposta não encontrada." });

    const proposalData = proposalSnap.data();
    if (!isSuperAdmin && proposalData?.tenantId !== tenantId)
      return res.status(403).json({ message: "Acesso negado." });

    if (!isMaster && !isSuperAdmin) {
      const canEdit = await checkPermission(userId, "proposals", "canEdit");
      if (!canEdit) {
        return res
          .status(403)
          .json({ message: "Sem permissão para editar propostas." });
      }
    }

    const safeUpdate: Record<string, unknown> = { updatedAt: Timestamp.now() };
    const fields = [
      "title",
      "clientId",
      "clientName",
      "clientEmail",
      "clientPhone",
      "clientAddress",
      "validUntil",
      "status",
      "products",
      "sistemas",
      "discount",
      "notes",
      "customNotes",
      "sections",
      "pdfSettings",
      "totalValue",
    ];

    fields.forEach((f) => {
      if (updateData[f] !== undefined) safeUpdate[f] = updateData[f];
    });

    if (updateData.products) {
      const subtotal = updateData.products.reduce(
        (sum: number, p: { total: number }) => sum + (p.total || 0),
        0
      );
      const discountAmount =
        (subtotal * (updateData.discount || proposalData?.discount || 0)) / 100;
      safeUpdate.totalValue = subtotal - discountAmount;
    }

    await proposalRef.update(safeUpdate);

    return res.json({ success: true, message: "Proposta atualizada." });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({ message: err.message });
  }
};

export const deleteProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const { tenantId, isMaster, isSuperAdmin, masterRef } =
      await resolveUserAndTenant(userId, req.user);

    const proposalRef = db.collection(PROPOSALS_COLLECTION).doc(id);
    const proposalSnap = await proposalRef.get();

    if (!proposalSnap.exists)
      return res.status(404).json({ message: "Proposta não encontrada." });

    const proposalData = proposalSnap.data();
    if (!isSuperAdmin && proposalData?.tenantId !== tenantId)
      return res.status(403).json({ message: "Acesso negado." });

    if (!isMaster && !isSuperAdmin) {
      const canDelete = await checkPermission(userId, "proposals", "canDelete");
      if (!canDelete) {
        return res
          .status(403)
          .json({ message: "Sem permissão para deletar propostas." });
      }
    }

    // Determine correct masterRef for usage decrement
    let targetMasterRef = masterRef;
    
    if (isSuperAdmin && proposalData?.tenantId && proposalData.tenantId !== tenantId) {
       const ownerQuery = await db.collection("users")
         .where("tenantId", "==", proposalData.tenantId)
         .limit(10)
         .get();
         
       let ownerDoc = ownerQuery.docs.find(d => !d.data().masterId);
       if (!ownerDoc && !ownerQuery.empty) {
         ownerDoc = ownerQuery.docs.find(d => ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role));
         if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
       }
       
       if (ownerDoc) {
         targetMasterRef = db.collection("users").doc(ownerDoc.id);
       }
    }

    await db.runTransaction(async (t) => {
      const pSnap = await t.get(proposalRef);
      if (!pSnap.exists) throw new Error("Proposta não encontrada.");

      const companyRef = db.collection("companies").doc(proposalData?.tenantId || tenantId);
      const companySnap = await t.get(companyRef);

      t.delete(proposalRef);
      t.update(targetMasterRef, { "usage.proposals": FieldValue.increment(-1) });

      if (companySnap.exists) {
        t.update(companyRef, { "usage.proposals": FieldValue.increment(-1) });
      }
    });

    return res.json({ success: true, message: "Proposta excluída." });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({ message: err.message });
  }
};
