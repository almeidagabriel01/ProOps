import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  checkFinancialPermission,
  resolveWalletRef,
  addMonths,
} from "../../lib/finance-helpers";
import { CreateTransactionDTO } from "../helpers/transaction-validation";
import { ReconciliationService } from "./reconciliation.service";

const COLLECTION_NAME = "transactions";

export class TransactionService {
  /**
   * Creates a transaction or multiple installments.
   * Handles wallet adjustments for paid transactions.
   */
  static async createTransaction(
    userId: string,
    user: any, // Decoded ID Token
    data: CreateTransactionDTO
  ) {
    const { tenantId: userTenantId, isSuperAdmin } =
      await checkFinancialPermission(userId, "canCreate", user);

    // Super admin can specify target tenant
    const tenantId =
      data.targetTenantId && isSuperAdmin ? data.targetTenantId : userTenantId;
    
    // Prepare data
    const now = Timestamp.now();
    
    // Apply reconciliation rules
    // This allows auto-categorization based on description even for manual entries
    const reconciliatedData = await ReconciliationService.applyRules(tenantId, { ...data });
    
    // Use the categorized data
    const finalData = reconciliatedData;
    
    return await db.runTransaction(async (t) => {
      const transactionsToCreate: Record<string, unknown>[] = [];
      const walletAdjustments = new Map<string, number>();

      const shouldGenerateInstallments =
        finalData.isInstallment &&
        (finalData.installmentCount || 0) > 1 &&
        (!finalData.installmentNumber || finalData.installmentNumber === 1);

      if (shouldGenerateInstallments) {
        const count = finalData.installmentCount!;
        const groupId = finalData.installmentGroupId || `gen_${now.toMillis()}`;
        const baseAmount = finalData.amount;

        for (let i = 0; i < count; i++) {
          const isFirst = i === 0;
          const currentStatus = isFirst ? finalData.status : "pending";

          // Date (launch date) stays the same for all installments
          const currentDate = finalData.date;

          // DueDate (vencimento) increments by month for each installment
          // If no dueDate provided, use date as base
          const baseDueDate = finalData.dueDate || finalData.date;
          const currentDueDate = addMonths(baseDueDate, i);

          transactionsToCreate.push({
            tenantId,
            type: finalData.type,
            description: isFirst
              ? finalData.description
              : `${finalData.description} (${i + 1}/${count})`,
            amount: baseAmount,
            date: currentDate,
            dueDate: currentDueDate,

            status: currentStatus,
            clientId: finalData.clientId || null,
            clientName: finalData.clientName || null,
            proposalId: finalData.proposalId || null,
            category: finalData.category || null,
            wallet: finalData.wallet || null,
            isInstallment: true,
            downPaymentType: finalData.downPaymentType || null,
            downPaymentPercentage: finalData.downPaymentPercentage || null,
            installmentCount: count,
            installmentNumber: i + 1,
            installmentGroupId: groupId,
            notes: finalData.notes || null,
            createdAt: now,
            updatedAt: now,
            createdById: userId,
          });

          if (currentStatus === "paid" && finalData.wallet) {
            const sign = finalData.type === "income" ? 1 : -1;
            const adj = sign * baseAmount;
            walletAdjustments.set(
              finalData.wallet,
              (walletAdjustments.get(finalData.wallet) || 0) + adj
            );
          }
        }
      } else {
        transactionsToCreate.push({
          tenantId,
          type: finalData.type,
          description: finalData.description.trim(),
          amount: finalData.amount,
          date: finalData.date,
          dueDate: finalData.dueDate || null,
          status: finalData.status,
          clientId: finalData.clientId || null,
          clientName: finalData.clientName || null,
          proposalId: finalData.proposalId || null,
          category: finalData.category || null,
          wallet: finalData.wallet || null,
          isDownPayment: !!finalData.isDownPayment,
          downPaymentType: finalData.downPaymentType || null,
          downPaymentPercentage: finalData.downPaymentPercentage || null,
          isInstallment: !!finalData.isInstallment,
          installmentCount: finalData.isInstallment ? (finalData.installmentCount || null) : null,
          installmentNumber: finalData.isInstallment ? (finalData.installmentNumber || null) : null,
          installmentGroupId: finalData.isInstallment ? (finalData.installmentGroupId || null) : null,
          notes: finalData.notes || null,
          createdAt: now,
          updatedAt: now,
          createdById: userId,
        });

        if (finalData.status === "paid" && finalData.wallet) {
          const sign = finalData.type === "income" ? 1 : -1;
          const adj = sign * finalData.amount;
          walletAdjustments.set(finalData.wallet, adj);
        }
      }

      // Update Wallets
      for (const [walletIdentifier, adjustment] of walletAdjustments.entries()) {
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
  }

  /**
   * Updates a transaction.
   * Handles recalculation of wallet balances if amount, wallet, or status changes.
   */
  static async updateTransaction(
    userId: string,
    user: any,
    id: string,
    updateData: Partial<CreateTransactionDTO>
  ) {
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      user
    );

    // Sanitize update data: if disabling installments, clear related fields
    if (updateData.isInstallment === false) {
      // Use 'as any' to allow setting null if type definition is strict, though Firestore allows it
      (updateData as any).installmentCount = null;
      (updateData as any).installmentNumber = null;
      (updateData as any).installmentGroupId = null;
    }

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

      // Use the transaction's tenantId for wallet lookup
      const txTenantId = currentData?.tenantId || tenantId;

      const shouldAdjustWallets =
        oldImpact !== newImpact || currentData?.wallet !== newData.wallet;

      const now = Timestamp.now();

      let oldWalletInfo = null;
      let newWalletInfo = null;
      let sameWalletInfo = null;

      // Firestore transaction rule requires all reads before writes.
      if (shouldAdjustWallets) {
        if (currentData?.wallet !== newData.wallet) {
          if (oldImpact !== 0 && currentData?.wallet) {
            oldWalletInfo = await resolveWalletRef(
              t,
              db,
              txTenantId,
              currentData.wallet
            );
          }
          if (newImpact !== 0 && newData.wallet) {
            newWalletInfo = await resolveWalletRef(t, db, txTenantId, newData.wallet);
          }
        } else {
          const diff = newImpact - oldImpact;
          if (diff !== 0 && newData.wallet) {
            sameWalletInfo = await resolveWalletRef(t, db, txTenantId, newData.wallet);
          }
        }
      }

      if (shouldAdjustWallets) {
        if (currentData?.wallet !== newData.wallet) {
          if (oldWalletInfo) {
            t.update(oldWalletInfo.ref, {
              balance: FieldValue.increment(-oldImpact),
              updatedAt: now,
            });
          }
          if (newWalletInfo) {
            t.update(newWalletInfo.ref, {
              balance: FieldValue.increment(newImpact),
              updatedAt: now,
            });
          }
        } else {
          const diff = newImpact - oldImpact;
          if (diff !== 0 && sameWalletInfo) {
            t.update(sameWalletInfo.ref, {
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
           proposalUpdate.installmentsWallet = newData.wallet;
        }
        
        t.update(proposalRef, proposalUpdate);
      }

      t.update(ref, { ...updateData, updatedAt: Timestamp.now() });
    });
  }

  /**
   * Batch update status of multiple transactions.
   */
  static async updateStatusBatch(
    userId: string,
    user: any,
    ids: string[],
    newStatus: "paid" | "pending" | "overdue"
  ) {
    const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canEdit",
      user
    );

    return await db.runTransaction(async (t) => {
      const now = Timestamp.now();
      const transactionsToUpdate: FirebaseFirestore.DocumentReference[] = [];
      const walletAdjustments = new Map<
        string,
        { tenantId: string; wallet: string; delta: number }
      >();

      // 1) Read all transactions first
      for (const id of uniqueIds) {
        const txRef = db.collection(COLLECTION_NAME).doc(id);
        const txSnap = await t.get(txRef);

        if (!txSnap.exists) continue;

        const txData = txSnap.data() as any;
        if (!txData) continue;

        if (!isSuperAdmin && txData.tenantId !== tenantId) {
          throw new Error("Acesso negado.");
        }

        const oldImpact =
          txData.status === "paid" && txData.wallet
            ? (txData.type === "income" ? 1 : -1) * (txData.amount || 0)
            : 0;

        const nextData = {
          status: newStatus,
          wallet: txData.wallet,
          type: txData.type,
          amount: txData.amount,
        };
        const newImpact =
          nextData.status === "paid" && nextData.wallet
            ? (nextData.type === "income" ? 1 : -1) * (nextData.amount || 0)
            : 0;

        const diff = newImpact - oldImpact;
        const txTenantId = txData.tenantId || tenantId;

        if (diff !== 0 && nextData.wallet) {
          const key = `${txTenantId}::${nextData.wallet}`;
          const prev = walletAdjustments.get(key);
          walletAdjustments.set(key, {
            tenantId: txTenantId,
            wallet: nextData.wallet,
            delta: (prev?.delta || 0) + diff,
          });
        }

        transactionsToUpdate.push(txRef);
      }

      // 2) Read all wallets before any write
      const walletRefs = new Map<string, FirebaseFirestore.DocumentReference>();
      for (const [key, adj] of walletAdjustments.entries()) {
        if (adj.delta === 0) continue;
        const walletInfo = await resolveWalletRef(t, db, adj.tenantId, adj.wallet);
        if (walletInfo) {
          walletRefs.set(key, walletInfo.ref);
        }
      }

      // 3) Write transaction statuses
      for (const txRef of transactionsToUpdate) {
        t.update(txRef, { status: newStatus, updatedAt: now });
      }

      // 4) Write wallet balance deltas
      for (const [key, adj] of walletAdjustments.entries()) {
        if (adj.delta === 0) continue;
        const walletRef = walletRefs.get(key);
        if (!walletRef) continue;

        t.update(walletRef, {
          balance: FieldValue.increment(adj.delta),
          updatedAt: now,
        });
      }
      
      return uniqueIds.length;
    });
  }

  /**
   * Deletes a transaction and reverts any wallet balance changes.
   */
  static async deleteTransaction(userId: string, user: any, id: string) {
    const { tenantId, isSuperAdmin } = await checkFinancialPermission(
      userId,
      "canDelete",
      user
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
  }
}
