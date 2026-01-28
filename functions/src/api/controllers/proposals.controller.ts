import { Request, Response } from "express";
import { db } from "../../init";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { checkProposalLimit } from "../../lib/billing-helpers";
import {
  UserDoc,
  resolveUserAndTenant,
  checkPermission,
} from "../../lib/auth-helpers";
import { resolveWalletRef } from "../../lib/finance-helpers";

const PROPOSALS_COLLECTION = "proposals";

export const createProposal = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.uid;
    const input = req.body;
    console.log("createProposal payload:", JSON.stringify(input, null, 2));

    // Relaxed validation for drafts
    const isDraft = input.status === "draft";

    if (!isDraft) {
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
    } else {
      // Draft specific defaults/validation
      if (!input.title) {
        input.title = `Rascunho ${new Date().toLocaleString()}`;
      }
      // Allow missing client for drafts (though frontend might enforce it usually)
      if (!input.clientName) input.clientName = "";
      if (input.totalValue === undefined || input.totalValue < 0)
        input.totalValue = 0;
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
      const ownerQuery = await db
        .collection("users")
        .where("tenantId", "==", userCompanyId)
        .limit(10)
        .get();

      let ownerDoc = ownerQuery.docs.find((d) => !d.data().masterId);
      if (!ownerDoc && !ownerQuery.empty) {
        ownerDoc = ownerQuery.docs.find((d) =>
          ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role),
        );
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
        extraExpense: input.extraExpense || 0,
        validUntil: input.validUntil || null,
        clientId: input.clientId,
        clientName: input.clientName,
        clientEmail: input.clientEmail || null,
        clientPhone: input.clientPhone || null,
        clientAddress: input.clientAddress || null,
        products: input.products || [],
        sistemas: input.sistemas || [],
        sections: input.sections || [],
        // Payment options
        downPaymentEnabled: input.downPaymentEnabled || false,
        downPaymentValue: input.downPaymentValue || 0,
        downPaymentWallet: input.downPaymentWallet || null,
        downPaymentDueDate: input.downPaymentDueDate || null,
        installmentsEnabled: input.installmentsEnabled || false,
        installmentsCount: input.installmentsCount || 1,
        installmentValue: input.installmentValue || 0,
        installmentsWallet: input.installmentsWallet || null,
        firstInstallmentDate: input.firstInstallmentDate || null,
        // PDF display settings (which elements to show/hide in PDF)
        pdfSettings: input.pdfSettings || null,
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
    console.log(
      `updateProposal payload for ${id}:`,
      JSON.stringify(updateData, null, 2),
    );

    if (!id) return res.status(400).json({ message: "ID inválido." });

    const { tenantId, isMaster, isSuperAdmin } = await resolveUserAndTenant(
      userId,
      req.user,
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
      "extraExpense",
      "notes",
      "customNotes",
      "sections",
      "pdfSettings",
      "totalValue",
      // Payment options
      "downPaymentEnabled",
      "downPaymentValue",
      "downPaymentWallet",
      "downPaymentDueDate",
      "installmentsEnabled",
      "installmentsCount",
      "installmentValue",
      "installmentsWallet",
      "firstInstallmentDate",
    ];

    fields.forEach((f) => {
      if (updateData[f] !== undefined) safeUpdate[f] = updateData[f];
    });

    if (updateData.products) {
      const subtotal = updateData.products.reduce(
        (sum: number, p: { total: number }) => sum + (p.total || 0),
        0,
      );
      const discountAmount =
        (subtotal * (updateData.discount || proposalData?.discount || 0)) / 100;
      const extraExpense =
        updateData.extraExpense !== undefined
          ? updateData.extraExpense
          : proposalData?.extraExpense || 0;
      safeUpdate.totalValue = subtotal - discountAmount + extraExpense;
    }

    await proposalRef.update(safeUpdate);

    // Criar receita automaticamente quando a proposta for aprovada
    const isBeingApproved =
      updateData.status === "approved" && proposalData?.status !== "approved";

    // Remover receita se sair de aprovada (Rascunho/Enviada)
    const isBeingReverted =
      proposalData?.status === "approved" &&
      updateData.status &&
      updateData.status !== "approved";

    // Update existing transaction due dates if proposal is already approved
    // and the user changed the due date fields
    const isAlreadyApproved =
      proposalData?.status === "approved" &&
      (!updateData.status || updateData.status === "approved");

    if (isAlreadyApproved) {
      const proposalTenantId = proposalData?.tenantId || tenantId;

      // Check for changes (undefined check is important because partial updates are possible)
      const changes = {
        dpValue:
          updateData.downPaymentValue !== undefined &&
          updateData.downPaymentValue !== proposalData?.downPaymentValue,
        dpWallet:
          updateData.downPaymentWallet !== undefined &&
          updateData.downPaymentWallet !== proposalData?.downPaymentWallet,
        dpDate:
          updateData.downPaymentDueDate !== undefined &&
          updateData.downPaymentDueDate !== proposalData?.downPaymentDueDate,

        instValue:
          updateData.installmentValue !== undefined &&
          updateData.installmentValue !== proposalData?.installmentValue,
        instWallet:
          updateData.installmentsWallet !== undefined &&
          updateData.installmentsWallet !== proposalData?.installmentsWallet,
        instDate:
          updateData.firstInstallmentDate !== undefined &&
          updateData.firstInstallmentDate !==
            proposalData?.firstInstallmentDate,

        title:
          updateData.title !== undefined &&
          updateData.title !== proposalData?.title,
      };

      if (Object.values(changes).some(Boolean)) {
        // Find transactions for this proposal
        const transactionsQuery = await db
          .collection("transactions")
          .where("tenantId", "==", proposalTenantId)
          .where("proposalGroupId", "==", id)
          .get();

        if (!transactionsQuery.empty) {
          const batch = db.batch();
          const walletAdjustments = new Map<string, number>();

          // Helper for balance adjustments
          const registerAdjustment = (walletName: string, amount: number) => {
            if (!walletName) return;
            const current = walletAdjustments.get(walletName) || 0;
            walletAdjustments.set(walletName, current + amount);
          };

          transactionsQuery.docs.forEach((doc) => {
            const txData = doc.data();
            const updatePayload: any = { updatedAt: Timestamp.now() };
            let shouldUpdate = false;

            // --- 0. Title Sync ---
            if (changes.title) {
              // Preserve prefixes like "Entrada: ", "Parcela X/Y: "
              let newDesc = updateData.title;
              if (txData.description.startsWith("Entrada: ")) {
                newDesc = `Entrada: ${newDesc}`;
              } else if (txData.description.includes("Parcela")) {
                // Regex to keep prefix? Or simpler reconstruction if we have context.
                // txData.description format: "Parcela 1/12: Old Title"
                const parts = txData.description.split(":");
                if (parts.length > 1) {
                  newDesc = `${parts[0]}: ${newDesc}`;
                }
              }
              updatePayload.description = newDesc;
              shouldUpdate = true;
            }

            // --- 1. Down Payment Handling ---
            if (txData.isDownPayment) {
              // Value Change
              if (changes.dpValue) {
                const newAmount = updateData.downPaymentValue;

                // If paid, revert old amount from old wallet, add new amount to (potentially new) wallet later
                if (txData.status === "paid" && txData.type === "income") {
                  registerAdjustment(txData.wallet, -txData.amount); // Revert OLD
                  // We will add NEW later, but wait, if wallet ALSO changes, we need to handle that.
                  // The "Add NEW" should happen using the *final* destination wallet.
                }

                updatePayload.amount = newAmount;
                shouldUpdate = true;
              }

              // Wallet Change
              if (changes.dpWallet) {
                // If paid, move money
                if (
                  txData.status === "paid" &&
                  txData.type === "income" &&
                  !changes.dpValue
                ) {
                  // Only wallet changed, amount same
                  registerAdjustment(txData.wallet, -txData.amount); // Remove from OLD
                  // Add to NEW comes later
                }
                updatePayload.wallet = updateData.downPaymentWallet;
                shouldUpdate = true;
              }

              // Date Change
              if (changes.dpDate) {
                updatePayload.dueDate = updateData.downPaymentDueDate;
                updatePayload.date = updateData.downPaymentDueDate;
                shouldUpdate = true;
              }

              // Apply Balance Logic for Down Payment (Income only)
              if (
                txData.status === "paid" &&
                txData.type === "income" &&
                (changes.dpValue || changes.dpWallet)
              ) {
                const finalAmount = changes.dpValue
                  ? updateData.downPaymentValue
                  : txData.amount;
                const finalWallet = changes.dpWallet
                  ? updateData.downPaymentWallet
                  : txData.wallet;
                registerAdjustment(finalWallet, finalAmount); // Add to NEW/CURRENT
              }
            }

            // --- 2. Installment Handling ---
            else if (txData.isInstallment) {
              // Value Change
              if (changes.instValue) {
                const newAmount = updateData.installmentValue;

                if (txData.status === "paid" && txData.type === "income") {
                  registerAdjustment(txData.wallet, -txData.amount);
                }

                updatePayload.amount = newAmount;
                shouldUpdate = true;
              }

              // Wallet Change
              if (changes.instWallet) {
                if (
                  txData.status === "paid" &&
                  txData.type === "income" &&
                  !changes.instValue
                ) {
                  registerAdjustment(txData.wallet, -txData.amount);
                }
                updatePayload.wallet = updateData.installmentsWallet;
                shouldUpdate = true;
              }

              // Date Change (First Installment Date shift)
              if (changes.instDate) {
                const installmentNumber = txData.installmentNumber || 1;
                if (updateData.firstInstallmentDate) {
                  const firstInstDate = new Date(
                    updateData.firstInstallmentDate + "T12:00:00",
                  );
                  const installmentDate = new Date(firstInstDate);
                  installmentDate.setMonth(
                    firstInstDate.getMonth() + (installmentNumber - 1),
                  );
                  const newDueDate = installmentDate
                    .toISOString()
                    .split("T")[0];

                  updatePayload.dueDate = newDueDate;
                  updatePayload.date = newDueDate;
                  shouldUpdate = true;
                }
              }

              // Apply Balance Logic for Installment
              if (
                txData.status === "paid" &&
                txData.type === "income" &&
                (changes.instValue || changes.instWallet)
              ) {
                const finalAmount = changes.instValue
                  ? updateData.installmentValue
                  : txData.amount;
                const finalWallet = changes.instWallet
                  ? updateData.installmentsWallet
                  : txData.wallet;
                registerAdjustment(finalWallet, finalAmount);
              }
            }

            if (shouldUpdate) {
              batch.update(doc.ref, updatePayload);
            }
          });

          // --- 3. Consolidate Wallet Updates ---
          // Need to fetch wallet refs to update balances
          if (walletAdjustments.size > 0) {
            const walletNames = Array.from(walletAdjustments.keys());
            // We can't really do "where name in [...]" easily if names are many?
            // Assuming reasonable number of wallets.

            // Since we are inside a loop, let's just do individual lookups or assume names are unique per tenant.
            // We will iterate and find them.

            // Optimization: fetch all tenant wallets? No, might be too many.
            // Fetch only involved wallets.

            for (const wName of walletNames) {
              const adjustment = walletAdjustments.get(wName);
              if (!adjustment) continue;

              const wQuery = await db
                .collection("wallets")
                .where("tenantId", "==", proposalTenantId)
                .where("name", "==", wName)
                .limit(1)
                .get();

              if (!wQuery.empty) {
                batch.update(wQuery.docs[0].ref, {
                  balance: FieldValue.increment(adjustment),
                  updatedAt: Timestamp.now(),
                });
              }
            }
          }

          await batch.commit();
          console.log(
            `Updated transactions/wallets for proposal ${id}. Changes: ${JSON.stringify(changes)}`,
          );
        }
      }
    }

    if (isBeingReverted) {
      await cleanupProposalTransactions(id, proposalData?.tenantId || tenantId);
    }

    if (isBeingApproved) {
      try {
        const mergedData = { ...proposalData, ...safeUpdate } as any;
        const proposalTenantId = mergedData.tenantId || tenantId;
        const now = Timestamp.now();
        const today = new Date();
        const dateStr = today.toISOString().split("T")[0];

        // Determinar carteira(s) - Prioriza o nome da carteira selecionada na proposta
        // Se não houver, busca o NOME da carteira padrão
        let defaultWalletName: string | null = null;

        const getDefaultWalletName = async () => {
          if (defaultWalletName) return defaultWalletName;

          const walletsQuery = await db
            .collection("wallets")
            .where("tenantId", "==", proposalTenantId)
            .where("isDefault", "==", true)
            .limit(1)
            .get();

          if (!walletsQuery.empty) {
            defaultWalletName = walletsQuery.docs[0].data().name;
            return defaultWalletName;
          }

          // Fallback: qualquer carteira ativa
          const anyWallet = await db
            .collection("wallets")
            .where("tenantId", "==", proposalTenantId)
            .where("status", "==", "active")
            .limit(1)
            .get();

          if (!anyWallet.empty) {
            defaultWalletName = anyWallet.docs[0].data().name;
            return defaultWalletName;
          }
          return null;
        };

        const transactionsToCreate: any[] = [];
        const walletAdjustments = new Map<string, number>();

        // Helper to track wallet adjustments
        const trackAdjustment = (
          walletName: string,
          amount: number,
          type: "income" | "expense",
        ) => {
          if (!walletName || amount === 0) return;
          const sign = type === "income" ? 1 : -1;
          const current = walletAdjustments.get(walletName) || 0;
          walletAdjustments.set(walletName, current + amount * sign);
        };

        const initialStatus = updateData.initialPaymentStatus || "pending";

        // ID único para agrupar entrada + parcelas da mesma proposta
        const proposalGroupId = `proposal_${id}_${now.toMillis()}`;

        // Verificar se tem tanto entrada quanto parcelas (para decidir se usa o groupId)
        const hasDownPayment =
          mergedData.downPaymentEnabled && mergedData.downPaymentValue > 0;
        const hasInstallments =
          mergedData.installmentsEnabled &&
          mergedData.installmentsCount > 0 &&
          mergedData.installmentValue > 0;
        const useProposalGrouping = hasDownPayment && hasInstallments;

        // 1. Entrada (Down Payment)
        if (hasDownPayment) {
          const wName =
            mergedData.downPaymentWallet || (await getDefaultWalletName());

          if (wName) {
            transactionsToCreate.push({
              tenantId: proposalTenantId,
              type: "income",
              description: `Entrada: ${mergedData.title || "Proposta"}`,
              amount: mergedData.downPaymentValue,
              date: dateStr,
              dueDate: mergedData.downPaymentDueDate || dateStr, // Usa data configurada ou hoje
              status: initialStatus,
              clientId: mergedData.clientId || null,
              clientName: mergedData.clientName || null,
              proposalId: id,
              proposalGroupId: useProposalGrouping ? proposalGroupId : null, // Agrupa se tiver parcelas também
              category: null,
              wallet: wName,
              isDownPayment: true, // Nova flag para identificar entrada
              isInstallment: false,
              installmentCount: null,
              installmentNumber: null,
              installmentGroupId: null,
              notes: "Entrada gerada automaticamente pela proposta",
              createdAt: now,
              updatedAt: now,
              createdById: userId,
            });
            if (initialStatus === "paid") {
              trackAdjustment(wName, mergedData.downPaymentValue, "income");
            }
          }
        }

        // 2. Parcelamento (Installments)
        if (hasInstallments) {
          const wName =
            mergedData.installmentsWallet || (await getDefaultWalletName());
          const installmentGroupId = `inst_${id}_${now.toMillis()}`;

          if (wName) {
            // Determinar a data base para a primeira parcela
            let firstInstDate: Date;
            if (mergedData.firstInstallmentDate) {
              // Usa a data configurada pelo usuário
              firstInstDate = new Date(
                mergedData.firstInstallmentDate + "T12:00:00",
              );
            } else {
              // Fallback: 30 dias a partir de hoje
              firstInstDate = new Date(today);
              firstInstDate.setDate(firstInstDate.getDate() + 30);
            }

            for (let i = 0; i < mergedData.installmentsCount; i++) {
              // Cada parcela é +1 mês a partir da primeira parcela (mantendo o dia do mês)
              const installmentDate = new Date(firstInstDate);
              installmentDate.setMonth(firstInstDate.getMonth() + i);
              const dueDate = installmentDate.toISOString().split("T")[0];

              transactionsToCreate.push({
                tenantId: proposalTenantId,
                type: "income",
                description: `Parcela ${i + 1}/${mergedData.installmentsCount}: ${mergedData.title || "Proposta"}`,
                amount: mergedData.installmentValue,
                date: dateStr,
                dueDate: dueDate,
                status: initialStatus,
                clientId: mergedData.clientId || null,
                clientName: mergedData.clientName || null,
                proposalId: id,
                proposalGroupId: useProposalGrouping ? proposalGroupId : null, // Agrupa se tiver entrada também
                category: null,
                wallet: wName,
                isDownPayment: false,
                isInstallment: true,
                installmentCount: mergedData.installmentsCount,
                installmentNumber: i + 1,
                installmentGroupId: installmentGroupId,
                notes: `Parcela ${i + 1}/${mergedData.installmentsCount} gerada automaticamente`,
                createdAt: now,
                updatedAt: now,
                createdById: userId,
              });

              if (initialStatus === "paid") {
                trackAdjustment(wName, mergedData.installmentValue, "income");
              }
            }
          }
        }

        // 3. Fallback: Se não tem nem entrada nem parcelamento (pagamento único total)
        const hasSpecifics =
          (mergedData.downPaymentEnabled && mergedData.downPaymentValue > 0) ||
          (mergedData.installmentsEnabled && mergedData.installmentsCount > 0);

        if (!hasSpecifics) {
          const finalTotalValue = mergedData.totalValue || 0;
          if (finalTotalValue > 0) {
            const wName = await getDefaultWalletName();
            if (wName) {
              let dueDate = mergedData.validUntil;
              if (!dueDate) {
                const d = new Date(today);
                d.setDate(d.getDate() + 30);
                dueDate = d.toISOString().split("T")[0];
              }

              transactionsToCreate.push({
                tenantId: proposalTenantId,
                type: "income",
                description: `Proposta: ${mergedData.title || "Sem título"}`,
                amount: finalTotalValue,
                date: dateStr,
                dueDate: dueDate,
                status: initialStatus,
                clientId: mergedData.clientId || null,
                clientName: mergedData.clientName || null,
                proposalId: id,
                category: null,
                wallet: wName,
                isInstallment: false,
                installmentCount: null,
                installmentNumber: null,
                installmentGroupId: null,
                notes:
                  "Receita gerada automaticamente pela aprovação da proposta",
                createdAt: now,
                updatedAt: now,
                createdById: userId,
              });

              if (initialStatus === "paid") {
                trackAdjustment(wName, finalTotalValue, "income");
              }
            }
          }
        }

        // Batch save
        if (transactionsToCreate.length > 0) {
          // Batch save transactions and update wallets
          const batch = db.batch();

          // 1. Create Transactions
          transactionsToCreate.forEach((docData) => {
            const ref = db.collection("transactions").doc();
            batch.set(ref, docData);
          });

          // 2. Update Wallets
          for (const [walletName, adjustment] of walletAdjustments.entries()) {
            if (adjustment === 0) continue;

            // Need to resolve wallet ref within the transaction logic?
            // Note: We are using db.batch() here, not t.update().
            // Ideally we should use the same transaction 't' if possible, or correct logic.
            // But 'proposals.controller.ts' lines 96 use `db.runTransaction` for CREATE.
            // HERE (updateProposal), lines 254 use `await proposalRef.update(safeUpdate)`.
            // It is NOT inside a transaction! It blindly calls `update`.

            // To ensure consistency, we should do lookups.
            // We can do lookups before the batch.

            // Resolve wallet by name
            const walletQuery = await db
              .collection("wallets")
              .where("tenantId", "==", proposalTenantId)
              .where("name", "==", walletName)
              .limit(1)
              .get();

            if (!walletQuery.empty) {
              const wRef = walletQuery.docs[0].ref;
              batch.update(wRef, {
                balance: FieldValue.increment(adjustment),
                updatedAt: now,
              });
            }
          }

          await batch.commit();
          console.log(
            `${transactionsToCreate.length} transações criadas e carteiras atualizadas para proposta ${id}`,
          );
        } else {
          console.warn(
            `Nenhuma transação criada para proposta ${id} (valores zerados ou sem carteira)`,
          );
        }
      } catch (transactionError) {
        // Não falhar a atualização da proposta se a criação da receita falhar
        console.error(
          `Erro ao criar receita automática para proposta ${id}:`,
          transactionError,
        );
      }
    }

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

    if (
      isSuperAdmin &&
      proposalData?.tenantId &&
      proposalData.tenantId !== tenantId
    ) {
      const ownerQuery = await db
        .collection("users")
        .where("tenantId", "==", proposalData.tenantId)
        .limit(10)
        .get();

      let ownerDoc = ownerQuery.docs.find((d) => !d.data().masterId);
      if (!ownerDoc && !ownerQuery.empty) {
        ownerDoc = ownerQuery.docs.find((d) =>
          ["MASTER", "master", "ADMIN", "admin"].includes(d.data().role),
        );
        if (!ownerDoc) ownerDoc = ownerQuery.docs[0];
      }

      if (ownerDoc) {
        targetMasterRef = db.collection("users").doc(ownerDoc.id);
      }
    }

    // Cleanup associated transactions (revenue) if they exist
    await cleanupProposalTransactions(id, proposalData?.tenantId || tenantId);

    await db.runTransaction(async (t) => {
      const pSnap = await t.get(proposalRef);
      if (!pSnap.exists) throw new Error("Proposta não encontrada.");

      const companyRef = db
        .collection("companies")
        .doc(proposalData?.tenantId || tenantId);
      const companySnap = await t.get(companyRef);

      t.delete(proposalRef);
      t.update(targetMasterRef, {
        "usage.proposals": FieldValue.increment(-1),
      });

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

/**
 * Helper to remove transactions associated with a proposal.
 * Reverses balance if transaction was already paid.
 */
async function cleanupProposalTransactions(
  proposalId: string,
  tenantId: string,
) {
  try {
    const txRef = db.collection("transactions");
    const snapshot = await txRef.where("proposalId", "==", proposalId).get();

    if (snapshot.empty) return;

    await db.runTransaction(async (t) => {
      for (const doc of snapshot.docs) {
        const data = doc.data();

        // 1. Reverse balance if paid
        if (data.status === "paid" && data.wallet && data.amount) {
          const isIncome = data.type === "income";
          const sign = isIncome ? 1 : -1;
          const offset = data.amount * sign;

          // To reverse, we subtract the offset: balance -= offset
          // But using increment: increment(-offset)
          const reverseAmount = -offset;

          const w = await resolveWalletRef(t, db, tenantId, data.wallet);
          if (w) {
            t.update(w.ref, {
              balance: FieldValue.increment(reverseAmount),
              updatedAt: Timestamp.now(),
            });
          }
        }

        // 2. Delete transaction
        t.delete(doc.ref);
      }
    });

    console.log(
      `Transactions cleaned up for reverted/deleted proposal ${proposalId}`,
    );
  } catch (error) {
    console.error(
      `Error cleaning up transactions for proposal ${proposalId}:`,
      error,
    );
  }
}
