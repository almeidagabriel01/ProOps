import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { checkProposalLimit } from "../../lib/billing-helpers";
import { UserDoc } from "../../lib/auth-helpers";

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

    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists)
      return res.status(404).json({ message: "Usuário não encontrado" });

    const userData = userSnap.data() as UserDoc;
    const userCompanyId = userData.tenantId || userData.companyId;

    if (!userCompanyId)
      return res.status(412).json({ message: "Usuário sem tenantId." });

    let masterData: UserDoc;
    let masterRef: FirebaseFirestore.DocumentReference;

    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && !!userData.subscription);

    if (isMaster) {
      masterData = userData;
      masterRef = userRef;
    } else {
      const masterId = userData.masterId || userData.masterID;
      if (!masterId)
        return res
          .status(412)
          .json({ message: "Erro na conta: Master não encontrado." });

      const [permSnap, masterSnap] = await Promise.all([
        userRef.collection("permissions").doc("proposals").get(),
        db.collection("users").doc(masterId).get(),
      ]);

      if (!permSnap.exists || !permSnap.data()?.canCreate) {
        return res
          .status(403)
          .json({ message: "Sem permissão para criar propostas." });
      }
      if (!masterSnap.exists) {
        return res
          .status(412)
          .json({ message: "Conta principal não encontrada." });
      }
      masterData = masterSnap.data() as UserDoc;
      masterRef = db.collection("users").doc(masterId);
    }

    if (
      masterData.subscription?.status &&
      !["ACTIVE", "TRIALING"].includes(masterData.subscription.status)
    ) {
      // Optional: check strict status. Existing code was loose for Admin/Free.
    }

    try {
      await checkProposalLimit(masterData);
    } catch (e) {
      const error = e as Error;
      return res
        .status(402)
        .json({ message: error.message, code: "resource-exhausted" });
    }

    const proposalId = await db.runTransaction(async (t) => {
      // Re-read master usage
      const freshMasterSnap = await t.get(masterRef);
      const freshMasterData = freshMasterSnap.data() as UserDoc;
      try {
        await checkProposalLimit(freshMasterData);
      } catch (e) {
        const error = e as Error;
        throw new Error(error.message);
      }

      const newRef = db.collection(PROPOSALS_COLLECTION).doc();

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
        createdByName: userData.name,
        companyId: userCompanyId,
        tenantId: userCompanyId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      t.update(masterRef, {
        "usage.proposals": FieldValue.increment(1),
        updatedAt: Timestamp.now(),
      });

      const companyRef = db.collection("companies").doc(userCompanyId);
      const companySnap = await t.get(companyRef);
      if (companySnap.exists) {
        t.update(companyRef, {
          "usage.proposals": FieldValue.increment(1),
          updatedAt: Timestamp.now(),
        });
      }

      return newRef.id;
    });

    return res.status(201).json({
      success: true,
      proposalId,
      message: "Proposta criada com sucesso!",
    });
  } catch (error) {
    console.error("createProposal Error:", error);
    const err = error as Error;
    return res.status(500).json({ message: err.message });
  }
};

export const updateProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const [userSnap, proposalSnap, permSnap] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection(PROPOSALS_COLLECTION).doc(id).get(),
      db
        .collection("users")
        .doc(userId)
        .collection("permissions")
        .doc("proposals")
        .get(),
    ]);

    if (!userSnap.exists)
      return res.status(404).json({ message: "Usuário não encontrado." });
    if (!proposalSnap.exists)
      return res.status(404).json({ message: "Proposta não encontrada." });

    const userData = userSnap.data() as UserDoc;
    const tenantId = userData.tenantId || userData.companyId;

    const proposalData = proposalSnap.data();
    if (proposalData?.tenantId !== tenantId)
      return res.status(403).json({ message: "Acesso negado." });

    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && !!userData.subscription);

    if (!isMaster) {
      if (!permSnap.exists || !permSnap.data()?.canEdit) {
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

    await db.collection(PROPOSALS_COLLECTION).doc(id).update(safeUpdate);

    return res.json({ success: true, message: "Proposta atualizada." });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ message: err.message });
  }
};

export const deleteProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const userRef = db.collection("users").doc(userId);
    const [userSnap, permSnap] = await Promise.all([
      userRef.get(),
      userRef.collection("permissions").doc("proposals").get(),
    ]);

    if (!userSnap.exists)
      return res.status(404).json({ message: "Usuário não encontrado." });
    const userData = userSnap.data() as UserDoc;
    const tenantId = userData.tenantId || userData.companyId;

    const role = (userData.role as string)?.toUpperCase();
    const isMaster =
      role === "MASTER" ||
      role === "ADMIN" ||
      role === "WK" ||
      (!userData.masterId && !!userData.subscription);

    if (!isMaster) {
      if (!permSnap.exists || !permSnap.data()?.canDelete) {
        return res
          .status(403)
          .json({ message: "Sem permissão para deletar propostas." });
      }
    }

    let masterRef: FirebaseFirestore.DocumentReference;
    if (isMaster) {
      masterRef = userRef;
    } else {
      const masterId = userData.masterId;
      if (!masterId)
        return res
          .status(412)
          .json({ message: "Configuração de conta inválida." });
      masterRef = db.collection("users").doc(masterId);
    }

    await db.runTransaction(async (t) => {
      const proposalRef = db.collection(PROPOSALS_COLLECTION).doc(id);
      const proposalSnap = await t.get(proposalRef);

      if (!proposalSnap.exists) throw new Error("Proposta não encontrada.");
      if (proposalSnap.data()?.tenantId !== tenantId)
        throw new Error("Acesso negado.");

      // Decrement usage
      const companyRef = db.collection("companies").doc(tenantId!);
      const companySnap = await t.get(companyRef);

      t.delete(proposalRef);
      t.update(masterRef, { "usage.proposals": FieldValue.increment(-1) });

      if (companySnap.exists) {
        t.update(companyRef, { "usage.proposals": FieldValue.increment(-1) });
      }
    });

    return res.json({ success: true, message: "Proposta excluída." });
  } catch (error) {
    // Map "Proposta não encontrada" to 404 if needed, but 500 is ok for now or custom handling
    const err = error as Error;
    return res.status(500).json({ message: err.message });
  }
};
