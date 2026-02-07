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
  paymentMode: "total" | "installmentValue";
  installmentValue: string;
  firstInstallmentDate: string;
  installmentsWallet: string;
  downPaymentEnabled: boolean;
  downPaymentValue: string;
  downPaymentWallet: string;
  downPaymentDueDate: string;
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
    paymentMode: "total",
    installmentValue: "",
    firstInstallmentDate: "",
    installmentsWallet: "",
    downPaymentEnabled: false,
    downPaymentValue: "",
    downPaymentWallet: "",
    downPaymentDueDate: "",
  });

  React.useEffect(() => {
    async function loadTransaction() {
      if (!transactionId) return;

      try {
        const data = await TransactionService.getTransactionById(transactionId);
        if (data) {
          setTransaction(data);
          const isPartOfGroup = !!(
            data.installmentGroupId && !data.proposalGroupId
          );
          const effectiveIsInstallment = data.isInstallment || isPartOfGroup;

          const initialData: EditTransactionFormData = {
            type: data.type,
            description: data.description,
            amount: data.amount.toFixed(2),
            date: data.date.split("T")[0],
            dueDate: data.dueDate?.split("T")[0] || "",
            status: data.status,
            clientId: data.clientId,
            clientName: data.clientName || "",
            category: data.category || "",
            wallet: data.wallet || "",
            notes: data.notes || "",
            isInstallment: effectiveIsInstallment,
            installmentCount: data.installmentCount || 1,
            paymentMode: "total",
            installmentValue: "",
            firstInstallmentDate: "",
            installmentsWallet: "",
            downPaymentEnabled: false,
            downPaymentValue: "",
            downPaymentWallet: "",
            downPaymentDueDate: "",
          };

          if (effectiveIsInstallment && data.installmentGroupId) {
            const all = await TransactionService.getTransactions(data.tenantId);
            const related = all
              .filter((t) => t.installmentGroupId === data.installmentGroupId)
              .sort(
                (a, b) =>
                  (a.installmentNumber || 0) - (b.installmentNumber || 0),
              );
            setRelatedInstallments(related);

            const realInstallments = related.filter((t) => !t.isDownPayment);
            if (realInstallments.length > 0) {
              initialData.installmentCount = realInstallments.length;
            }

            const downPayment = related.find(
              (t) => t.isDownPayment || t.installmentNumber === 0,
            );
            if (downPayment) {
              initialData.downPaymentEnabled = true;
              initialData.downPaymentValue = downPayment.amount.toFixed(2);
              initialData.downPaymentWallet = downPayment.wallet || "";
              initialData.downPaymentDueDate =
                downPayment.dueDate?.split("T")[0] ||
                downPayment.date.split("T")[0];
            }

            const firstInstallment = realInstallments.find(
              (t) => (t.installmentNumber || 0) > 0,
            );

            if (firstInstallment) {
              initialData.installmentValue = firstInstallment.amount.toFixed(2);
              initialData.installmentsWallet = firstInstallment.wallet || "";
              initialData.firstInstallmentDate =
                firstInstallment.dueDate?.split("T")[0] || "";

              if (initialData.paymentMode === "total") {
                initialData.wallet = firstInstallment.wallet || "";
              }
            }

            if (!data.proposalGroupId) {
              const total = related.reduce((sum, t) => sum + t.amount, 0);
              if (initialData.paymentMode === "total") {
                initialData.amount = total.toFixed(2);
              }
            }
          } else if (data.proposalGroupId) {
            const all = await TransactionService.getTransactions(data.tenantId);
            const related = all
              .filter((t) => t.proposalGroupId === data.proposalGroupId)
              .sort((a, b) => {
                if (a.isDownPayment) return -1;
                if (b.isDownPayment) return 1;
                return new Date(a.date).getTime() - new Date(b.date).getTime();
              });
            setRelatedInstallments(related);
          }

          setFormData(initialData);
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
    let workingList = baseList.map((inst) => {
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
            amount: 0, // Placeholder, calculated below
            wallet: "", // Placeholder
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
    // We must distribute the total correctly to avoid rounding errors
    const isTotalMode = formData.paymentMode === "total";
    const totalAmount = parseFloat(formData.amount || "0");
    const downPaymentVal = formData.downPaymentEnabled
      ? parseFloat(formData.downPaymentValue || "0")
      : 0;

    // If in Installment Value mode, we trust the input value per installment
    // BUT user complained about 55000.04 -> 55000.00.
    // If they switch to "Total" mode, we must ensure the sum is exactly the total.

    const installmentsToUpdate = resultList.filter((t) => !t.isDownPayment);
    const count = installmentsToUpdate.length;

    // Apply Down Payment updates
    if (downPaymentItem) {
      // Update Down Payment Item in the list
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
      // Precision Logic:
      // e.g. 100 / 3 = 33.33, 33.33, 33.34

      // Floor to 2 decimals
      const baseAmount =
        Math.floor((remainingForInstallments / count) * 100) / 100;
      const totalBase = baseAmount * count;
      const remainder =
        Math.round((remainingForInstallments - totalBase) * 100) / 100;
      // Remainder is essentially number of cents to distribute. e.g. 0.01 or 0.02
      const centsToDistribute = Math.round(remainder * 100); // 1 or 2 cents

      installmentsToUpdate.forEach((inst, index) => {
        // Distribute cents to the first N installments
        const addCent = index < centsToDistribute;
        const finalAmount = baseAmount + (addCent ? 0.01 : 0);

        // Find in resultList and update
        const mainIdx = resultList.indexOf(inst);
        if (mainIdx >= 0) {
          resultList[mainIdx] = {
            ...resultList[mainIdx],
            amount: finalAmount, // JS float math is generally safe for addition of 0.01 to 2-decimal floats, but toFixed ensures
            wallet: formData.wallet,
          };
        }
      });
    } else if (!isTotalMode && count > 0) {
      // Installment Value Mode
      // We just set everyone to the value
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

      // Identify Deleted IDs
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
          amount: parseFloat(inst.amount.toFixed(2)), // Ensure we send cleaned floats
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
    transaction,
    relatedInstallments,
    previewInstallments,
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
