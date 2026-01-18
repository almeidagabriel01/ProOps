import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  checkFinancialPermission,
  resolveWalletRef,
  addMonths,
} from "../../lib/finance-helpers";

const COLLECTION_NAME = "transactions";

export const createTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const data = req.body;
    const now = Timestamp.now();

    // Validation
    if (
      !data.description ||
      !data.amount ||
      !data.date ||
      !data.type ||
      !data.status
    ) {
      return res.status(400).json({ message: "Campos obrigatórios faltando." });
    }

    const { tenantId: userTenantId, isSuperAdmin } =
      await checkFinancialPermission(userId, "canCreate", req.user);

    // Super admin can specify target tenant
    const tenantId =
      data.targetTenantId && isSuperAdmin ? data.targetTenantId : userTenantId;

    const result = await db.runTransaction(async (t) => {
      const transactionsToCreate: Record<string, unknown>[] = [];
      const walletAdjustments = new Map<string, number>();

      const shouldGenerateInstallments =
        data.isInstallment &&
        (data.installmentCount || 0) > 1 &&
        (!data.installmentNumber || data.installmentNumber === 1);

      if (shouldGenerateInstallments) {
        const count = data.installmentCount!;
        const groupId = data.installmentGroupId || `gen_${now.toMillis()}`;
        const baseAmount = data.amount;

        for (let i = 0; i < count; i++) {
          const isFirst = i === 0;
          const currentStatus = isFirst ? data.status : "pending";

          // Date (launch date) stays the same for all installments
          const currentDate = data.date;

          // DueDate (vencimento) increments by month for each installment
          // If no dueDate provided, use date as base
          const baseDueDate = data.dueDate || data.date;
          const currentDueDate = addMonths(baseDueDate, i);

          transactionsToCreate.push({
            tenantId,
            type: data.type,
            description: isFirst
              ? data.description
              : `${data.description} (${i + 1}/${count})`,
            amount: baseAmount,
            date: currentDate,
            dueDate: currentDueDate,

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
          isDownPayment: !!data.isDownPayment,
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

      // Update Wallets
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
          t.update(walletInfo.ref, {
            balance: FieldValue.increment(adjustment),
            updatedAt: now,
          });
        }
      }

      // Write Transactions
      const createdIds: string[] = [];
      const collectionRef = db.collection(COLLECTION_NAME);

      for (const txData of transactionsToCreate) {
        const ref = collectionRef.doc();
        createdIds.push(ref.id);
        t.set(ref, txData);
      }

      return {
        transactionId: createdIds[0],
        count: transactionsToCreate.length,
      };
    });

    return res.status(201).json({
      success: true,
      transactionId: result.transactionId,
      message:
        result.count > 1
          ? `${result.count} parcelas criadas.`
          : "Transação criada.",
    });
  } catch (error: unknown) {
    console.error("createTransaction Error:", error);
    const message = error instanceof Error ? error.message : "Erro interno.";
    return res.status(500).json({ message });
  }
};

export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;
    const updateData = req.body;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      req.user
    );

    await db.runTransaction(async (t) => {
      const ref = db.collection(COLLECTION_NAME).doc(id);
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error("Transação não encontrada.");

      const currentData = snap.data();
      if (!currentData) throw new Error("Dados da transação inválidos.");

      if (!isSuperAdmin && currentData.tenantId !== tenantId)
        throw new Error("Acesso negado.");

      // Calc Impact logic
      let oldImpact = 0;
      if (currentData?.status === "paid" && currentData?.wallet) {
        oldImpact =
          (currentData.type === "income" ? 1 : -1) * (currentData.amount || 0);
      }

      const newData = { ...currentData, ...updateData };
      let newImpact = 0;
      if (newData.status === "paid" && newData.wallet) {
        newImpact =
          (newData.type === "income" ? 1 : -1) * (newData.amount || 0);
      }

      // Use the transaction's tenantId for wallet lookup (not the user's tenantId)
      const txTenantId = currentData?.tenantId || tenantId;

      if (oldImpact !== newImpact || currentData?.wallet !== newData.wallet) {
        const now = Timestamp.now();
        if (currentData?.wallet !== newData.wallet) {
          // Reverse old
          if (oldImpact !== 0 && currentData?.wallet) {
            const w = await resolveWalletRef(
              t,
              db,
              txTenantId,
              currentData.wallet
            );
            if (w)
              t.update(w.ref, {
                balance: FieldValue.increment(-oldImpact),
                updatedAt: now,
              });
          }
          // Apply new
          if (newImpact !== 0 && newData.wallet) {
            const w = await resolveWalletRef(t, db, txTenantId, newData.wallet);
            if (w)
              t.update(w.ref, {
                balance: FieldValue.increment(newImpact),
                updatedAt: now,
              });
          }
        } else {
          // Same wallet
          const diff = newImpact - oldImpact;
          if (diff !== 0 && newData.wallet) {
            const w = await resolveWalletRef(t, db, txTenantId, newData.wallet);
            if (w)
              t.update(w.ref, {
                balance: FieldValue.increment(diff),
                updatedAt: now,
              });
          }
        }
      }

      // Sync Wallet change to Proposal
      if (
        newData.wallet &&
        currentData.wallet !== newData.wallet &&
        currentData.proposalId
      ) {
        const proposalRef = db.collection("proposals").doc(currentData.proposalId);
        
        const proposalUpdate: any = {};
        if (currentData.isDownPayment) {
          proposalUpdate.downPaymentWallet = newData.wallet;
        } else {
           // Default to installments wallet if not explicitly down payment
           proposalUpdate.installmentsWallet = newData.wallet;
        }
        
        t.update(proposalRef, proposalUpdate);
      }

      t.update(ref, { ...updateData, updatedAt: Timestamp.now() });
    });

    return res.json({ success: true, message: "Atualizado com sucesso." });
  } catch (error: unknown) {
    console.error("updateTransaction Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar.";
    return res.status(500).json({ message });
  }
};

export const deleteTransaction = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const { id } = req.params;

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canDelete",
      req.user
    );

    await db.runTransaction(async (t) => {
      const ref = db.collection(COLLECTION_NAME).doc(id);
      const snap = await t.get(ref);
      if (!snap.exists) throw new Error("Transação não encontrada.");

      const currentData = snap.data();
      if (!isSuperAdmin && currentData?.tenantId !== tenantId)
        throw new Error("Acesso negado.");

      // Check if linked to an approved proposal
      if (currentData?.proposalId) {
        const proposalRef = db.collection("proposals").doc(currentData.proposalId);
        const proposalSnap = await t.get(proposalRef);
        
        if (proposalSnap.exists) {
           const proposalData = proposalSnap.data();
           if (proposalData?.status === "approved") {
             throw new Error("Não é possível excluir um lançamento vinculado a uma proposta Aprovada. Reverta o status da proposta para Rascunho antes de excluir.");
           }
        }
      }

      if (currentData?.status === "paid" && currentData?.wallet) {
        const impact =
          (currentData.type === "income" ? 1 : -1) * (currentData.amount || 0);
        // Use transaction's tenantId for wallet lookup
        const txTenantId = currentData?.tenantId || tenantId;
        const w = await resolveWalletRef(t, db, txTenantId, currentData.wallet);
        if (w) {
          t.update(w.ref, {
            balance: FieldValue.increment(-impact),
            updatedAt: Timestamp.now(),
          });
        }
      }

      t.delete(ref);
    });

    return res.json({ success: true, message: "Excluído com sucesso." });
  } catch (error: unknown) {
    console.error("deleteTransaction Error:", error);
    const message = error instanceof Error ? error.message : "Erro ao excluir.";
    return res.status(500).json({ message });
  }
};
