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

    const { tenantId } = await checkFinancialPermission(
      userId,
      "canCreate",
      req.user
    );

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
          const currentDate = isFirst ? data.date : addMonths(data.date, i);
          const currentDueDate = data.dueDate
            ? isFirst
              ? data.dueDate
              : addMonths(data.dueDate, i)
            : undefined;

          transactionsToCreate.push({
            tenantId,
            type: data.type,
            description: isFirst
              ? data.description
              : `${data.description} (${i + 1}/${count})`,
            amount: baseAmount,
            date: currentDate,
            dueDate: currentDueDate || null,
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
      if (!isSuperAdmin && currentData?.tenantId !== tenantId)
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

      if (oldImpact !== newImpact || currentData?.wallet !== newData.wallet) {
        const now = Timestamp.now();
        if (currentData?.wallet !== newData.wallet) {
          // Reverse old
          if (oldImpact !== 0 && currentData?.wallet) {
            const w = await resolveWalletRef(
              t,
              db,
              tenantId,
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
            const w = await resolveWalletRef(t, db, tenantId, newData.wallet);
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
            const w = await resolveWalletRef(t, db, tenantId, newData.wallet);
            if (w)
              t.update(w.ref, {
                balance: FieldValue.increment(diff),
                updatedAt: now,
              });
          }
        }
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

      if (currentData?.status === "paid" && currentData?.wallet) {
        const impact =
          (currentData.type === "income" ? 1 : -1) * (currentData.amount || 0);
        const w = await resolveWalletRef(t, db, tenantId, currentData.wallet);
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
