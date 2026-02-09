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

interface ExtendedTransaction extends Transaction {
  hasDownPayment?: boolean;
  downPaymentAmount?: number;
  downPaymentWallet?: string;
  downPaymentDate?: string;
  firstInstallmentDate?: string;
}
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
  paymentMode: "total" | "installmentValue";
  installmentValue: string;
  firstInstallmentDate: string;
  installmentsWallet: string;
  downPaymentEnabled: boolean;
  downPaymentValue: string;
  downPaymentWallet: string;
  downPaymentDueDate: string;
}

// Helper to extract fields relevant to Total Mode
const getTotalFields = (data: EditTransactionFormData) => ({
  amount: data.amount,
  wallet: data.wallet,
  dueDate: data.dueDate,
  isInstallment: data.isInstallment,
  installmentCount: data.installmentCount,
  downPaymentEnabled: data.downPaymentEnabled,
  downPaymentValue: data.downPaymentValue,
  downPaymentWallet: data.downPaymentWallet,
  downPaymentDueDate: data.downPaymentDueDate,
});

// Helper to extract fields relevant to Installment Value Mode
const getInstallmentFields = (data: EditTransactionFormData) => ({
  installmentValue: data.installmentValue,
  installmentsWallet: data.installmentsWallet,
  firstInstallmentDate: data.firstInstallmentDate,
  isInstallment: data.isInstallment,
  installmentCount: data.installmentCount,
  downPaymentEnabled: data.downPaymentEnabled,
  downPaymentValue: data.downPaymentValue,
  downPaymentWallet: data.downPaymentWallet,
  downPaymentDueDate: data.downPaymentDueDate,
});

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
    paymentMode: "total",
    installmentValue: "",
    firstInstallmentDate: "",
    installmentsWallet: "",
    downPaymentEnabled: false,
    downPaymentValue: "",
    downPaymentWallet: "",
    downPaymentDueDate: "",
  });

  // Independent buffers for each mode
  const [modeBuffers, setModeBuffers] = React.useState<{
    total: Partial<EditTransactionFormData>;
    installmentValue: Partial<EditTransactionFormData>;
  }>({
    total: {},
    installmentValue: {},
  });

  const fetchTransaction = React.useCallback(async () => {
    if (!transactionId) return;

    try {
      if (
        params.id === "new" ||
        (typeof params.id === "string" && params.id.startsWith("new?"))
      ) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const data = await TransactionService.getTransactionById(transactionId);
      // Ensure numeric fields are strings for the form
      const safeData = {
        ...data,
      } as ExtendedTransaction;

      setTransaction(safeData);

      // If it's an installment, fetch related ones
      if (
        safeData.isInstallment &&
        safeData.installmentGroupId &&
        safeData.installmentGroupId !== "stub-group-id"
      ) {
        try {
          const group = await TransactionService.getInstallmentsByGroupId(
            safeData.installmentGroupId,
          );
          // Sort by installment number
          const sorted = group.sort(
            (a: Transaction, b: Transaction) =>
              (a.installmentNumber || 0) - (b.installmentNumber || 0),
          );
          setRelatedInstallments(sorted);
        } catch (error) {
          console.error("Error fetching related installments:", error);
          setRelatedInstallments([]);
        }
      } else {
        setRelatedInstallments([]);
      }

      // Initialize form data
      setFormData((prev) => ({
        ...prev,
        type: safeData.type,
        description: safeData.description,
        amount: safeData.amount.toString(),
        // Use displayed date (dueDate if expense, date if income/other preferences)
        // But for editing, we usually want the core date or due date fields separate.
        // Let's stick to: date -> data.date, dueDate -> data.dueDate
        date: safeData.date ? safeData.date.split("T")[0] : "",
        dueDate: safeData.dueDate ? safeData.dueDate.split("T")[0] : "",
        status: safeData.status,
        clientId: safeData.clientId,
        clientName: safeData.clientName || "",
        category: safeData.category || "",
        wallet: safeData.wallet || "",
        notes: safeData.notes || "",

        // Installment/Recurrence logic
        isInstallment: safeData.isInstallment ?? false,
        installmentCount: safeData.installmentCount || 1,

        // Payment Mode Logic for Edit
        // If it has installments, we probably want "installmentValue" mode or "total" mode?
        // Let's infer:
        paymentMode: safeData.isInstallment ? "total" : "total", // Defaulting to total is safer for now

        // Check for down payment (needs heuristic if not explicitly flagged)
        downPaymentEnabled: safeData.hasDownPayment || false,
        downPaymentValue: safeData.downPaymentAmount
          ? safeData.downPaymentAmount.toString()
          : "",
        downPaymentWallet: safeData.downPaymentWallet || "",
        downPaymentDueDate: safeData.downPaymentDate
          ? safeData.downPaymentDate.split("T")[0]
          : "",

        installmentValue:
          safeData.isInstallment && safeData.amount
            ? (safeData.amount / (safeData.installmentCount || 1)).toString() // Approximation
            : "",
        installmentsWallet: safeData.isInstallment ? safeData.wallet || "" : "",
        firstInstallmentDate: safeData.firstInstallmentDate
          ? safeData.firstInstallmentDate.split("T")[0]
          : "",
      }));
    } catch (error) {
      console.error("Error fetching transaction:", error);
      toast.error("Erro ao carregar lançamento.");
      router.push("/financial");
    } finally {
      setIsLoading(false);
    }
  }, [transactionId, params.id, router]);

  React.useEffect(() => {
    fetchTransaction();
  }, [fetchTransaction]);

  const switchPaymentMode = (newMode: "total" | "installmentValue") => {
    if (newMode === formData.paymentMode) return;

    setFormData((prev) => {
      // 1. Snapshot current state to the buffer of the OLD mode
      return prev;
    });

    // Correct Implementation:
    const currentMode = formData.paymentMode;
    const currentFields =
      currentMode === "total"
        ? getTotalFields(formData)
        : getInstallmentFields(formData);

    // Update Buffer with current values
    setModeBuffers((prev) => ({
      ...prev,
      [currentMode]: currentFields,
    }));

    // Get Target values
    // Hybrid Sync Logic:
    // If target buffer is empty, calculate defaults. Otherwise, use buffer.
    const targetBuffer = modeBuffers[newMode];
    const isTargetEmpty =
      newMode === "total"
        ? !targetBuffer.amount
        : !targetBuffer.installmentValue;

    let computedValues: Partial<EditTransactionFormData> = {};

    if (isTargetEmpty) {
      if (newMode === "installmentValue") {
        // Total -> Installment
        const total = parseFloat(formData.amount || "0");
        const downPayment = formData.downPaymentEnabled
          ? parseFloat(formData.downPaymentValue || "0")
          : 0;
        const count = formData.installmentCount || 1;
        const remaining = Math.max(0, total - downPayment);
        const installmentVal =
          count > 0 ? (remaining / count).toFixed(2) : "0.00";

        computedValues = {
          installmentValue: installmentVal,
          installmentsWallet: formData.wallet,
          firstInstallmentDate: formData.date, // Default
          isInstallment: true,
          installmentCount: count,
          downPaymentEnabled: formData.downPaymentEnabled,
          downPaymentValue: formData.downPaymentValue,
          downPaymentWallet: formData.wallet,
          downPaymentDueDate: formData.date,
        };
      } else {
        // Installment -> Total
        const instVal = parseFloat(formData.installmentValue || "0");
        const count = formData.installmentCount || 1;
        const downPayment = formData.downPaymentEnabled
          ? parseFloat(formData.downPaymentValue || "0")
          : 0;
        const total = instVal * count + downPayment;

        computedValues = {
          amount: total.toFixed(2),
          wallet: formData.installmentsWallet || formData.wallet,
          dueDate: formData.firstInstallmentDate || formData.date,
          // Keep these for potential switch back
          isInstallment: true,
          installmentCount: count,
          downPaymentEnabled: formData.downPaymentEnabled,
          downPaymentValue: formData.downPaymentValue,
          downPaymentWallet: formData.downPaymentWallet,
          downPaymentDueDate: formData.downPaymentDueDate,
        };
      }
    }

    setFormData((prev) => ({
      ...prev,
      paymentMode: newMode,

      ...(newMode === "total"
        ? {
            amount: isTargetEmpty
              ? computedValues.amount || ""
              : targetBuffer.amount || "",
            wallet: isTargetEmpty
              ? computedValues.wallet || ""
              : targetBuffer.wallet || "",
            dueDate: isTargetEmpty
              ? computedValues.dueDate || ""
              : targetBuffer.dueDate || "",

            isInstallment:
              targetBuffer.isInstallment ??
              computedValues.isInstallment ??
              false,
            installmentCount:
              targetBuffer.installmentCount ??
              computedValues.installmentCount ??
              1,
            downPaymentEnabled:
              targetBuffer.downPaymentEnabled ??
              computedValues.downPaymentEnabled ??
              false,
            downPaymentValue:
              targetBuffer.downPaymentValue ??
              computedValues.downPaymentValue ??
              "",
            downPaymentWallet:
              targetBuffer.downPaymentWallet ??
              computedValues.downPaymentWallet ??
              "",
            downPaymentDueDate:
              targetBuffer.downPaymentDueDate ??
              computedValues.downPaymentDueDate ??
              "",

            // Clear Installment Fields
            installmentValue: "",
            installmentsWallet: "",
            firstInstallmentDate: "",
          }
        : {
            installmentValue: isTargetEmpty
              ? computedValues.installmentValue || ""
              : targetBuffer.installmentValue || "",
            installmentsWallet: isTargetEmpty
              ? computedValues.installmentsWallet || ""
              : targetBuffer.installmentsWallet || "",
            firstInstallmentDate: isTargetEmpty
              ? computedValues.firstInstallmentDate || ""
              : targetBuffer.firstInstallmentDate || "",

            isInstallment:
              targetBuffer.isInstallment ??
              computedValues.isInstallment ??
              true,
            installmentCount:
              targetBuffer.installmentCount ??
              computedValues.installmentCount ??
              1,
            downPaymentEnabled:
              targetBuffer.downPaymentEnabled ??
              computedValues.downPaymentEnabled ??
              false,
            downPaymentValue:
              targetBuffer.downPaymentValue ??
              computedValues.downPaymentValue ??
              "",
            downPaymentWallet:
              targetBuffer.downPaymentWallet ??
              computedValues.downPaymentWallet ??
              "",
            downPaymentDueDate:
              targetBuffer.downPaymentDueDate ??
              computedValues.downPaymentDueDate ??
              "",

            // Clear Total Fields
            amount: "",
            wallet: "",
            dueDate: "",
          }),
    }));
  };

  const addMonths = (dateStr: string, months: number): string => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    dateObj.setMonth(dateObj.getMonth() + months);
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const previewInstallments = React.useMemo(() => {
    if (!transaction) return [];

    const baseList =
      relatedInstallments.length > 0 ? relatedInstallments : [transaction];
    const dateShifted = formData.date !== transaction.date;

    // 1. First pass: Apply basic updates and collect list
    const workingList = baseList.map((inst) => {
      let newDate = inst.date;
      let newDueDate = inst.dueDate;

      if (dateShifted) {
        newDate = shiftDateByTransform(
          inst.date,
          transaction.date,
          formData.date,
        );
      }

      if (inst.dueDate && transaction.dueDate && formData.dueDate) {
        if (!inst.isDownPayment) {
          newDueDate = shiftDateByTransform(
            inst.dueDate,
            transaction.dueDate,
            formData.dueDate,
          );
        }
      }

      if (inst.isDownPayment && formData.downPaymentDueDate) {
        newDueDate = formData.downPaymentDueDate;
      }

      return {
        ...inst,
        date: newDate,
        dueDate: newDueDate,
        status: formData.status,
      } as Transaction;
    });

    workingList.sort(
      (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0),
    );

    if (transaction.proposalGroupId) {
      return workingList;
    }

    // 2. Adjust for Count Changes (Add/Remove)
    const targetCount = parseInt(formData.installmentCount.toString(), 10);
    const currentInstallments = workingList.filter((t) => !t.isDownPayment);
    const downPaymentItem = workingList.find((t) => t.isDownPayment);

    const effectiveTargetCount = isNaN(targetCount)
      ? currentInstallments.length
      : targetCount;

    let resultList: Transaction[] = [];

    if (effectiveTargetCount < currentInstallments.length) {
      // Shrink
      resultList = currentInstallments.slice(0, effectiveTargetCount);
    } else if (effectiveTargetCount > currentInstallments.length) {
      // Grow
      resultList = [...currentInstallments];
      let last = resultList[resultList.length - 1];
      if (!last && downPaymentItem) last = downPaymentItem;

      if (last) {
        for (
          let i = currentInstallments.length + 1;
          i <= effectiveTargetCount;
          i++
        ) {
          const newDate = addMonths(last.date, 1);
          const newDueDate = last.dueDate
            ? addMonths(last.dueDate, 1)
            : undefined;

          const newItem: Transaction = {
            ...last,
            id: `temp-${i}`,
            installmentNumber: i,
            installmentCount: effectiveTargetCount,
            date: newDate,
            dueDate: newDueDate,
            amount: 0,
            wallet: "",
            status: "pending",
            notes: "",
            clientId: undefined,
            clientName: "",
            isDownPayment: false,
            parentTransactionId: last.parentTransactionId || undefined,
          };
          resultList.push(newItem);
          last = newItem;
        }
      }
    } else {
      resultList = [...currentInstallments];
    }

    // Re-add down payment if exists
    if (downPaymentItem) {
      resultList = [downPaymentItem, ...resultList];
    }

    // 3. RECACLULATE AMOUNTS with PRECISION LOGIC
    const isTotalMode = formData.paymentMode === "total";
    const totalAmount = parseFloat(formData.amount || "0");
    const downPaymentVal = formData.downPaymentEnabled
      ? parseFloat(formData.downPaymentValue || "0")
      : 0;

    const installmentsToUpdate = resultList.filter((t) => !t.isDownPayment);
    const count = installmentsToUpdate.length;

    // Apply Down Payment updates
    if (downPaymentItem) {
      const idx = resultList.indexOf(downPaymentItem);
      if (idx >= 0) {
        resultList[idx] = {
          ...resultList[idx],
          amount: downPaymentVal,
          wallet: formData.downPaymentWallet || formData.wallet,
        };
      }
    }

    if (isTotalMode && count > 0) {
      const remainingForInstallments = totalAmount - downPaymentVal;
      const baseAmount =
        Math.floor((remainingForInstallments / count) * 100) / 100;
      const totalBase = baseAmount * count;
      const remainder = Math.round(
        (remainingForInstallments - totalBase) * 100,
      );

      installmentsToUpdate.forEach((inst, index) => {
        const addCent = index < remainder;
        const finalAmount = baseAmount + (addCent ? 0.01 : 0);

        const mainIdx = resultList.indexOf(inst);
        if (mainIdx >= 0) {
          resultList[mainIdx] = {
            ...resultList[mainIdx],
            amount: finalAmount,
            wallet: formData.wallet,
          };
        }
      });
    } else if (!isTotalMode && count > 0) {
      // Installment Value Mode
      const val = parseFloat(formData.installmentValue || "0");
      const wallet = formData.installmentsWallet || formData.wallet;

      installmentsToUpdate.forEach((inst) => {
        const mainIdx = resultList.indexOf(inst);
        if (mainIdx >= 0) {
          resultList[mainIdx] = {
            ...resultList[mainIdx],
            amount: val,
            wallet: wallet,
          };
        }
      });
    }

    return resultList.map((t) => ({
      ...t,
      installmentCount: effectiveTargetCount,
    }));
  }, [transaction, formData, relatedInstallments]);

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

      const previewRealIds = new Set(
        previewInstallments
          .filter((t) => !t.id.startsWith("temp-"))
          .map((t) => t.id),
      );
      const deletedIds = relatedInstallments
        .filter((t) => !previewRealIds.has(t.id) && t.id !== transaction.id)
        .map((t) => t.id);

      if (deletedIds.length > 0) {
        operations.push(
          ...deletedIds.map((id) => TransactionService.deleteTransaction(id)),
        );
      }

      previewInstallments.forEach((inst) => {
        const basePayload = {
          date: inst.date,
          dueDate: inst.dueDate,
          installmentCount: inst.installmentCount,
          installmentNumber: inst.installmentNumber,
          amount: parseFloat(inst.amount.toFixed(2)),
          status: inst.status,
          wallet: inst.wallet,
          description: formData.description.trim(),
          category: formData.category,
          clientId: formData.clientId,
          clientName: formData.clientName,
          notes: formData.notes,
          type: formData.type,
          isInstallment: formData.isInstallment,
          isDownPayment: inst.isDownPayment,
          installmentGroupId: transaction.installmentGroupId,
        };

        if (inst.id.startsWith("temp-")) {
          operations.push(
            TransactionService.createTransaction({
              ...basePayload,
              tenantId: transaction.tenantId,
              installmentGroupId: transaction.installmentGroupId,
              isInstallment: true,
              isDownPayment: false,
            } as unknown as Omit<Transaction, "id">),
          );
        } else {
          operations.push(
            TransactionService.updateTransaction(inst.id, basePayload),
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
    switchPaymentMode, // New handler
    transaction,
    relatedInstallments,

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
    refetch: fetchTransaction,
  };
}
