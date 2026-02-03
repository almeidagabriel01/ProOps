"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { useRouter, useParams } from "next/navigation";
import {
  TransactionService,
  Transaction,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { usePagePermission } from "@/hooks/usePagePermission";
import { shiftDateByTransform } from "@/utils/date-utils";

export interface EditTransactionFormData {
  type: TransactionType;
  description: string;
  amount: string;
  date: string;
  dueDate: string;
  status: TransactionStatus;
  clientId: string | undefined;
  clientName: string;
  category: string;
  wallet: string;
  notes: string;
  isInstallment: boolean;
  installmentCount: number;
}

export function useEditTransaction() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params.id as string;
  const {
    canEdit,
    canView,
    isLoading: permLoading,
  } = usePagePermission("financial");

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [transaction, setTransaction] = React.useState<Transaction | null>(
    null,
  );
  const [relatedInstallments, setRelatedInstallments] = React.useState<
    Transaction[]
  >([]);

  const [formData, setFormData] = React.useState<EditTransactionFormData>({
    type: "income",
    description: "",
    amount: "",
    date: "",
    dueDate: "",
    status: "pending",
    clientId: undefined,
    clientName: "",
    category: "",
    wallet: "",
    notes: "",
    isInstallment: false,
    installmentCount: 1,
  });

  React.useEffect(() => {
    async function loadTransaction() {
      if (!transactionId) return;

      try {
        const data = await TransactionService.getTransactionById(transactionId);

        if (data) {
          setTransaction(data);

          setFormData({
            type: data.type,
            description: data.description,
            amount: data.amount.toString(), // Will be overwritten if group found
            date: data.date.split("T")[0],
            dueDate: data.dueDate?.split("T")[0] || "",
            status: data.status,
            clientId: data.clientId,
            clientName: data.clientName || "",
            category: data.category || "",
            wallet: data.wallet || "",
            notes: data.notes || "",
            isInstallment: data.isInstallment || false,
            installmentCount: data.installmentCount || 1,
          });

          if (data.isInstallment && data.installmentGroupId) {
            // We need to fetch all transactions to find related ones.
            const all = await TransactionService.getTransactions(data.tenantId);
            const related = all
              .filter((t) => t.installmentGroupId === data.installmentGroupId)
              .sort(
                (a, b) =>
                  (a.installmentNumber || 0) - (b.installmentNumber || 0),
              );
            setRelatedInstallments(related);

            // If it's an installment group (but NOT a proposal group), set amount to TOTAL
            if (!data.proposalGroupId) {
              const total = related.reduce((sum, t) => sum + t.amount, 0);
              setFormData((prev) => ({ ...prev, amount: total.toString() }));
            }
          } else if (data.proposalGroupId) {
            // If part of a proposal group, fetch siblings (Entrada + Parcelas)
            const all = await TransactionService.getTransactions(data.tenantId);
            const related = all
              .filter((t) => t.proposalGroupId === data.proposalGroupId)
              // Sort: Allocating Down Payment first, then by date/created
              .sort((a, b) => {
                if (a.isDownPayment) return -1;
                if (b.isDownPayment) return 1;
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              });
            setRelatedInstallments(related);

            // If it's an installment group (but NOT a proposal group), set amount to TOTAL
            setRelatedInstallments(related);
            // Proposal group logic ends here
          }
        }
      } catch (error) {
        console.error("Error loading transaction:", error);
        toast.error("Erro ao carregar lançamento");
      } finally {
        setIsLoading(false);
      }
    }

    loadTransaction();
  }, [transactionId]);

  // Helper to add months to a date string (YYYY-MM-DD) safely
  const addMonths = (dateStr: string, months: number): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    dateObj.setMonth(dateObj.getMonth() + months);

    // Manual format to avoid timezone shifts from toISOString
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Derived state: Preview Installments with shifted dates
  const previewInstallments = React.useMemo(() => {
    if (!transaction) return [];

    // Use relatedInstallments if available, otherwise use current transaction as base (e.g. converting single to installment)
    const baseList =
      relatedInstallments.length > 0 ? relatedInstallments : [transaction];

    const dateShifted = formData.date !== transaction.date;

    // 1. Shift existing installments based on date changes
    const shifted = baseList.map((inst) => {
      // Current transaction is fully overridden by form data
      if (inst.id === transaction.id) {
        return {
          ...inst,
          date: formData.date,
          dueDate: formData.dueDate || undefined,
          amount:
            formData.isInstallment && formData.installmentCount > 0
              ? parseFloat(formData.amount) / formData.installmentCount
              : parseFloat(formData.amount),
        };
      }

      // Only shift future (standard logic here)
      if (
        (inst.installmentNumber || 0) <= (transaction.installmentNumber || 0)
      ) {
        return inst;
      }

      // Calculate new values
      let newDate = inst.date;
      let newDueDate = inst.dueDate;

      // Apply Date shift if Date changed
      if (dateShifted) {
        newDate = shiftDateByTransform(
          inst.date,
          transaction.date,
          formData.date,
        );
      }

      // Apply DueDate shift logic
      if (inst.dueDate && transaction.dueDate && formData.dueDate) {
        newDueDate = shiftDateByTransform(
          inst.dueDate,
          transaction.dueDate,
          formData.dueDate,
        );
      } else if (
        formData.dueDate &&
        transaction.dueDate &&
        formData.dueDate !== transaction.dueDate &&
        inst.dueDate
      ) {
        newDueDate = shiftDateByTransform(
          inst.dueDate,
          transaction.dueDate,
          formData.dueDate,
        );
      }

      return {
        ...inst,
        date: newDate,
        dueDate: newDueDate,
      };
    });

    // 2. Sort by installment number
    shifted.sort(
      (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0),
    );

    // If it's a proposal transaction, do NOT allow adding/removing items via count match.
    // The structure is fixed by the proposal.
    if (transaction.proposalGroupId) {
      return shifted;
    }

    // 3. Handle Installment Count Changes (Add/Remove)
    const targetCount = parseInt(formData.installmentCount.toString(), 10); // Ensure it's an integer
    const currentCount = shifted.length;

    if (targetCount < currentCount) {
      // Cut off extra installments from the end
      return shifted.slice(0, targetCount);
    } else if (targetCount > currentCount) {
      // Add new items
      const extra: Transaction[] = [];
      let last = shifted[shifted.length - 1];

      for (let i = currentCount + 1; i <= targetCount; i++) {
        const newDate = addMonths(last.date, 1);
        const newDueDate = last.dueDate
          ? addMonths(last.dueDate, 1)
          : undefined;

        const newItem: Transaction = {
          ...last,
          id: `temp-${i}`, // Temporary ID for new items
          installmentNumber: i,
          installmentCount: targetCount, // All should update to new count
          date: newDate,
          dueDate: newDueDate,
          status: "pending", // New ones are pending
          // Clear specific fields that might not carry over or need to be reset
          notes: "",
          clientId: undefined,
          clientName: "",
        };
        extra.push(newItem);
        last = newItem;
      }

      const result = [...shifted, ...extra];
      // Update installmentCount for ALL items to match new total
      return result.map((t) => ({ ...t, installmentCount: targetCount }));
    }

    // If targetCount == currentCount, just update installmentCount
    return shifted.map((t) => ({ ...t, installmentCount: targetCount }));
  }, [
    transaction,
    formData.date,
    formData.dueDate,
    formData.amount,
    formData.installmentCount,
    relatedInstallments,
    formData.isInstallment,
  ]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleClientChange = (data: {
    clientId?: string;
    clientName: string;
    isNew: boolean;
  }) => {
    setFormData((prev) => ({
      ...prev,
      clientId: data.clientId,
      clientName: data.clientName,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    setIsSaving(true);
    try {
      const operations: Promise<unknown>[] = [];

      // Identify Deleted IDs
      const previewRealIds = new Set(
        previewInstallments
          .filter((t) => !t.id.startsWith("temp-"))
          .map((t) => t.id),
      );
      const deletedIds = relatedInstallments
        .filter((t) => !previewRealIds.has(t.id) && t.id !== transaction.id) // Don't delete the current one if it's the only one left
        .map((t) => t.id);

      // 1. Delete removed installments
      if (deletedIds.length > 0) {
        operations.push(
          ...deletedIds.map((id) => TransactionService.deleteTransaction(id)),
        );
      }

      // 2. Create New / Update Existing
      previewInstallments.forEach((inst) => {
        if (inst.id.startsWith("temp-")) {
          // Create New
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...createPayload } = inst;
          operations.push(
            TransactionService.createTransaction({
              ...createPayload,
              amount: parseFloat(inst.amount.toString()),
              description: inst.description || "",
              date: inst.date,
              type: inst.type,
              clientId: inst.clientId,
              tenantId: transaction.tenantId, // Must include tenantId for creation
              installmentGroupId: transaction.installmentGroupId, // Must include group ID
            } as unknown as Omit<Transaction, "id">),
          );
        } else {
          // Update Existing
          const updatePayload: Partial<Transaction> = {
            date: inst.date,
            dueDate: inst.dueDate,
            installmentCount: inst.installmentCount,
            installmentNumber: inst.installmentNumber,
            amount: parseFloat(inst.amount.toString()), // Propagate amount changes if any
            status: inst.status, // Propagate status changes if any
          };

          if (inst.id === transaction.id) {
            // Full update for current transaction from formData
            updatePayload.type = formData.type;
            updatePayload.description = formData.description.trim();
            // If it's an installment group (non-proposal), distribute the amount
            if (
              transaction.isInstallment &&
              transaction.installmentGroupId &&
              !transaction.proposalGroupId
            ) {
              // The amount in formData is the TOTAL. we need to divide it.
              // HOWEVER, check if installmentCount changed?
              // If count changed, the preview logic handles the split.
              // If count didn't change, we just need to use the value from preview logic.

              // Actually, the previewInstallments logic ALREADY calculates the individual amounts based on the formData.amount?
              // Let's check previewInstallments logic.
              // "amount: parseFloat(formData.amount)" in previewInstallments map.
              // We need to change that logic too.

              // For the main transaction update here, we should probably set the individual amount.
              const total = parseFloat(formData.amount);
              const count = parseInt(formData.installmentCount.toString());
              updatePayload.amount = total / count;
            } else {
              updatePayload.amount = parseFloat(formData.amount);
            }
            updatePayload.status = formData.status;
            updatePayload.clientId = formData.clientId;
            updatePayload.clientName = formData.clientName;
            updatePayload.category = formData.category;
            updatePayload.wallet = formData.wallet;
            updatePayload.notes = formData.notes;
          }
          operations.push(
            TransactionService.updateTransaction(inst.id, updatePayload),
          );
        }
      });

      await Promise.all(operations);

      toast.success("Lançamento atualizado com sucesso!");
      router.push("/financial");
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Erro ao atualizar lançamento");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    formData,
    setFormData,
    handleChange,
    handleClientChange,
    handleSubmit,
    transaction,
    relatedInstallments,
    previewInstallments, // Exported for UI
    transactionId,
    isLoading: isLoading || permLoading,
    isSaving,
    canEdit,
    canView,
    isProposalTransaction: !!transaction?.proposalGroupId,
    groupTotalValue:
      transaction?.proposalGroupId && relatedInstallments.length > 0
        ? relatedInstallments.reduce((sum, t) => sum + t.amount, 0)
        : null,
  };
}
