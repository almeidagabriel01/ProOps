"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { useRouter, useParams } from "next/navigation";
import {
  TransactionService,
  Transaction,
  TransactionType,
  TransactionStatus,
  UpdateFinancialEntryWithInstallmentsPayload,
} from "@/services/transaction-service";

interface ExtendedTransaction extends Transaction {
  hasDownPayment?: boolean;
  downPaymentAmount?: number;
  downPaymentWallet?: string;
  downPaymentDate?: string;
  firstInstallmentDate?: string;
}
const isDownPaymentLike = (t: Transaction): boolean =>
  !!t.isDownPayment || (t.installmentNumber || 0) === 0;

const dateOnly = (value?: string): string => {
  if (!value) return "";
  return value.includes("T") ? value.split("T")[0] : value;
};

const sameClient = (a: Transaction, b: Transaction): boolean => {
  const aClientId = a.clientId || "";
  const bClientId = b.clientId || "";
  if (aClientId && bClientId) return aClientId === bClientId;
  return (a.clientName || "").trim() === (b.clientName || "").trim();
};

const isLikelyOrphanDownPaymentForGroup = (
  candidate: Transaction,
  anchor: Transaction,
): boolean => {
  if (!isDownPaymentLike(candidate)) return false;
  if (candidate.installmentGroupId || candidate.proposalGroupId) return false;
  if (candidate.id === anchor.id) return false;
  if ((candidate.description || "").trim() !== (anchor.description || "").trim())
    return false;
  if (candidate.type !== anchor.type) return false;
  if (!sameClient(candidate, anchor)) return false;
  const candidateDate = dateOnly(candidate.date || candidate.dueDate);
  const anchorDate = dateOnly(anchor.date || anchor.dueDate);
  if (candidateDate && anchorDate && candidateDate !== anchorDate) return false;
  return true;
};
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
  downPaymentType: "value" | "percentage";
  downPaymentPercentage: string;
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
  downPaymentType: data.downPaymentType,
  downPaymentPercentage: data.downPaymentPercentage,
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
  downPaymentType: data.downPaymentType,
  downPaymentPercentage: data.downPaymentPercentage,
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
  const [extraTransactionIds, setExtraTransactionIds] = React.useState<string[]>(
    [],
  );

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
    downPaymentType: "value",
    downPaymentPercentage: "",
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

  const getDownPaymentAmount = React.useCallback(
    (data: EditTransactionFormData) => {
      if (!data.downPaymentEnabled) return 0;

      if (data.downPaymentType === "percentage") {
        const baseTotal =
          data.paymentMode === "installmentValue"
            ? parseFloat(data.installmentValue || "0") *
              (data.installmentCount || 1)
            : parseFloat(data.amount || "0");
        return (
          (baseTotal * parseFloat(data.downPaymentPercentage || "0")) / 100
        );
      }

      return parseFloat(data.downPaymentValue || "0");
    },
    [],
  );

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

      let groupTransactions: Transaction[] = [];

      // If it's an installment, fetch related ones
      if (
        (safeData.isInstallment || safeData.isDownPayment) &&
        safeData.installmentGroupId &&
        safeData.installmentGroupId !== "stub-group-id"
      ) {
        try {
          const group = await TransactionService.getInstallmentsByGroupId(
            safeData.installmentGroupId,
            safeData.tenantId,
          );
          // Sort by installment number
          groupTransactions = group.sort(
            (a: Transaction, b: Transaction) =>
              (a.installmentNumber || 0) - (b.installmentNumber || 0),
          );

          // Include likely orphan down payment (legacy inconsistent data) so backend can reattach it atomically.
          const allTenantTransactions = await TransactionService.getTransactions(
            safeData.tenantId,
          );
          const orphanCandidates = allTenantTransactions.filter((t) =>
            isLikelyOrphanDownPaymentForGroup(t, safeData),
          );
          if (orphanCandidates.length === 1) {
            groupTransactions = [...groupTransactions, orphanCandidates[0]].sort(
              (a: Transaction, b: Transaction) =>
                (a.installmentNumber || 0) - (b.installmentNumber || 0),
            );
            setExtraTransactionIds([orphanCandidates[0].id]);
          } else {
            setExtraTransactionIds([]);
          }
          setRelatedInstallments(groupTransactions);
        } catch (error) {
          console.error("Error fetching related installments:", error);
          setRelatedInstallments([]);
          setExtraTransactionIds([]);
        }
      } else {
        setRelatedInstallments([]);
        setExtraTransactionIds([]);
      }

      // DERIVE FORM STATE FROM GROUP (if exists) OR SINGLE TRANSACTION
      const downPaymentItem = groupTransactions.find((t) => t.isDownPayment);
      const regularInstallments = groupTransactions.filter(
        (t) => !t.isDownPayment,
      );

      // Determine if we should treat this as an installment group edit
      const hasGroup = groupTransactions.length > 0;

      // Calculate Total Amount
      // If it's a group, sum everyone (including down payment)
      // If single, just use safeData.amount
      const totalAmount = hasGroup
        ? groupTransactions.reduce((sum, t) => sum + t.amount, 0)
        : safeData.amount;

      // Installment Count:
      // If group, count regular installments.
      // If single, use safeData.installmentCount
      const instCount = hasGroup
        ? regularInstallments.length
        : safeData.installmentCount || 1;

      // Installment Value (for form pre-fill if needed):
      // If group, take the first regular installment's amount (approximation)
      const firstRegular = regularInstallments[0];
      const instValue = firstRegular
        ? firstRegular.amount
        : hasGroup
          ? 0
          : safeData.amount / (safeData.installmentCount || 1);

      // Initialize form data
      setFormData((prev) => ({
        ...prev,
        type: safeData.type,
        description: safeData.description,
        amount: totalAmount.toFixed(2),
        // Use displayed date (dueDate if expense, date if income/other preferences)
        date: safeData.date ? safeData.date.split("T")[0] : "",
        dueDate:
          hasGroup && firstRegular?.dueDate
            ? firstRegular.dueDate.split("T")[0]
            : safeData.dueDate
              ? safeData.dueDate.split("T")[0]
              : "",
        status: safeData.status,
        clientId: safeData.clientId,
        clientName: safeData.clientName || "",
        category: safeData.category || "",
        wallet:
          hasGroup && firstRegular?.wallet
            ? firstRegular.wallet
            : safeData.wallet || "",
        notes: safeData.notes || "",

        // Installment/Recurrence logic
        // It is an installment if it has a group OR if the single transaction says so
        isInstallment: hasGroup || (safeData.isInstallment ?? false),
        installmentCount: instCount > 0 ? instCount : 1,

        // Payment Mode Logic for Edit
        // Default to "total" as it's the most common entry point, but could infer based on consistency
        paymentMode: "total",

        // Down Payment Logic
        downPaymentEnabled: !!downPaymentItem,
        downPaymentType:
          (downPaymentItem?.downPaymentType as "value" | "percentage") ||
          "value",
        downPaymentPercentage:
          downPaymentItem?.downPaymentType === "percentage"
            ? String(downPaymentItem?.downPaymentPercentage || "")
            : "",
        downPaymentValue: downPaymentItem
          ? downPaymentItem.amount.toFixed(2)
          : "",
        downPaymentWallet: downPaymentItem?.wallet || safeData.wallet || "",
        downPaymentDueDate: downPaymentItem?.date
          ? downPaymentItem.date.split("T")[0]
          : "",

        installmentValue: instValue.toFixed(2),
        installmentsWallet: firstRegular?.wallet || safeData.wallet || "",
        firstInstallmentDate: firstRegular?.date
          ? firstRegular.date.split("T")[0]
          : safeData.date
            ? safeData.date.split("T")[0]
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
        const downPayment = getDownPaymentAmount(formData);
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
          downPaymentType: formData.downPaymentType,
          downPaymentPercentage: formData.downPaymentPercentage,
          downPaymentValue: formData.downPaymentValue,
          downPaymentWallet: formData.downPaymentWallet, // Preserve existing value
          downPaymentDueDate: formData.date,
        };
      } else {
        // Installment -> Total
        const instVal = parseFloat(formData.installmentValue || "0");
        const count = formData.installmentCount || 1;
        const downPayment = getDownPaymentAmount(formData);
        const total = instVal * count + downPayment;

        computedValues = {
          amount: total.toFixed(2),
          wallet: formData.installmentsWallet || formData.wallet,
          dueDate: formData.firstInstallmentDate || formData.date,
          // Keep these for potential switch back
          isInstallment: true,
          installmentCount: count,
          downPaymentEnabled: formData.downPaymentEnabled,
          downPaymentType: formData.downPaymentType,
          downPaymentPercentage: formData.downPaymentPercentage,
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
            downPaymentType:
              targetBuffer.downPaymentType ??
              computedValues.downPaymentType ??
              "value",
            downPaymentPercentage:
              targetBuffer.downPaymentPercentage ??
              computedValues.downPaymentPercentage ??
              "",
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
            downPaymentType:
              targetBuffer.downPaymentType ??
              computedValues.downPaymentType ??
              "value",
            downPaymentPercentage:
              targetBuffer.downPaymentPercentage ??
              computedValues.downPaymentPercentage ??
              "",
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

    const firstRegularOriginal = baseList.find((t) => !t.isDownPayment);

    const targetStartDate =
      formData.paymentMode === "installmentValue"
        ? formData.firstInstallmentDate
        : formData.dueDate;

    const baseInstallmentNumber = firstRegularOriginal?.installmentNumber || 1;

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

      if (!inst.isDownPayment && targetStartDate) {
        const currentNum = inst.installmentNumber || 1;
        const offset = currentNum - baseInstallmentNumber;
        newDueDate = addMonths(targetStartDate, offset);
      }

      if (inst.isDownPayment && formData.downPaymentDueDate) {
        newDueDate = formData.downPaymentDueDate;
      }

      return {
        ...inst,
        date: newDate,
        dueDate: newDueDate,
        status: inst.status,
      } as Transaction;
    });

    workingList.sort(
      (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0),
    );

    if (transaction.proposalGroupId) {
      return workingList;
    }

    // 2. Adjust for Count Changes (Add/Remove)
    const targetCount = formData.isInstallment
      ? parseInt(formData.installmentCount.toString(), 10)
      : 1;
    const currentInstallments = workingList.filter((t) => !t.isDownPayment);
    const existingDownPaymentItem = workingList.find((t) => t.isDownPayment);

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
      if (!last && existingDownPaymentItem) last = existingDownPaymentItem;

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

    // 3. RECACLULATE AMOUNTS with PRECISION LOGIC
    const isTotalMode = formData.paymentMode === "total";
    const totalAmount = parseFloat(formData.amount || "0");
    const downPaymentVal = getDownPaymentAmount(formData);

    // Synchronize down payment entry for non-proposal groups
    const shouldHaveDownPayment =
      formData.downPaymentEnabled && downPaymentVal > 0;
    let downPaymentItem = resultList.find((t) => t.isDownPayment);

    if (!shouldHaveDownPayment && downPaymentItem) {
      resultList = resultList.filter((t) => !t.isDownPayment);
      downPaymentItem = undefined;
    }

    if (shouldHaveDownPayment && !downPaymentItem) {
      const firstInstallment = resultList.find((t) => !t.isDownPayment);
      const baseDate =
        formData.downPaymentDueDate ||
        formData.date ||
        firstInstallment?.date ||
        transaction.date;
      const baseDueDate =
        formData.downPaymentDueDate ||
        firstInstallment?.dueDate ||
        transaction.dueDate ||
        transaction.date;

      downPaymentItem = {
        ...(firstInstallment || transaction),
        id: "temp-downpayment",
        isDownPayment: true,
        isInstallment: false,
        installmentNumber: 0,
        installmentCount: effectiveTargetCount + 1,
        date: baseDate,
        dueDate: baseDueDate,
        wallet: formData.downPaymentWallet || formData.wallet,
        amount: downPaymentVal,
      };

      resultList = [downPaymentItem, ...resultList];
    }

    const installmentsToUpdate = resultList.filter((t) => !t.isDownPayment);
    const count = installmentsToUpdate.length;

    // Apply Down Payment updates
    if (downPaymentItem) {
      const idx = resultList.indexOf(downPaymentItem);
      if (idx >= 0) {
        resultList[idx] = {
          ...resultList[idx],
          amount: downPaymentVal,
          date: formData.downPaymentDueDate || resultList[idx].date,
          dueDate: formData.downPaymentDueDate || resultList[idx].dueDate,
          wallet: formData.downPaymentWallet, // decoupled: no fallback to main wallet
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

    // 4. Enforce Sequential Numbering
    let regularIndex = 0;
    return resultList.map((t) => {
      let instNum = t.installmentNumber;

      if (t.isDownPayment) {
        instNum = 0;
      } else {
        regularIndex++;
        instNum = regularIndex;
      }

      return {
        ...t,
        installmentCount: effectiveTargetCount,
        installmentNumber: instNum,
      };
    });
  }, [transaction, formData, relatedInstallments, getDownPaymentAmount]);

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
      const payload: UpdateFinancialEntryWithInstallmentsPayload = {
        type: formData.type,
        description: formData.description.trim(),
        amount: formData.amount,
        date: formData.date,
        dueDate: formData.dueDate,
        status: formData.status,
        clientId: formData.clientId,
        clientName: formData.clientName,
        category: formData.category,
        wallet: formData.wallet,
        notes: formData.notes,
        isInstallment: formData.isInstallment,
        installmentCount: formData.installmentCount,
        paymentMode: formData.paymentMode,
        installmentValue: formData.installmentValue,
        firstInstallmentDate: formData.firstInstallmentDate,
        installmentsWallet:
          formData.paymentMode === "total"
            ? formData.wallet
            : formData.installmentsWallet,
        downPaymentEnabled: formData.downPaymentEnabled,
        downPaymentType: formData.downPaymentType,
        downPaymentPercentage: formData.downPaymentPercentage,
        downPaymentValue: formData.downPaymentValue,
        downPaymentWallet: formData.downPaymentWallet,
        downPaymentDueDate: formData.downPaymentDueDate,
        expectedUpdatedAt: transaction.updatedAt,
        targetTenantId: transaction.tenantId,
        extraTransactionIds,
      };

      await TransactionService.updateFinancialEntryWithInstallments(
        transaction.id,
        payload,
      );

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
