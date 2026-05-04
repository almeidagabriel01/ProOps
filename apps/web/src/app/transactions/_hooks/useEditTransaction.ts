"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
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
  if (candidate.id === anchor.id) return false;

  // Se ambos têm groupIds, eles deveriam estar ligados via fetch normal de grupo — ignorar aqui.
  const anchorHasGroup = !!anchor.installmentGroupId || !!anchor.proposalGroupId;
  const candidateHasGroup = !!candidate.installmentGroupId || !!candidate.proposalGroupId;
  if (anchorHasGroup && candidateHasGroup) return false;

  if (
    (candidate.description || "").trim() !== (anchor.description || "").trim()
  )
    return false;
  if (candidate.type !== anchor.type) return false;
  if (!sameClient(candidate, anchor)) return false;
  const candidateDate = dateOnly(candidate.date || candidate.dueDate);
  const anchorDate = dateOnly(anchor.date || anchor.dueDate);
  if (candidateDate && anchorDate && candidateDate !== anchorDate) return false;
  return true;
};
import { usePagePermission } from "@/hooks/usePagePermission";
import { Wallet } from "@/types";
import { useWalletsData } from "@/app/wallets/_hooks/useWalletsData";

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
  isRecurring: boolean;
  installmentCount: number;
  installmentInterval: number;
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
  isRecurring: data.isRecurring,
  installmentCount: data.installmentCount,
  installmentInterval: data.installmentInterval,
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
  isRecurring: data.isRecurring,
  installmentCount: data.installmentCount,
  installmentInterval: data.installmentInterval,
  downPaymentEnabled: data.downPaymentEnabled,
  downPaymentType: data.downPaymentType,
  downPaymentPercentage: data.downPaymentPercentage,
  downPaymentValue: data.downPaymentValue,
  downPaymentWallet: data.downPaymentWallet,
  downPaymentDueDate: data.downPaymentDueDate,
});

const buildEditTransactionSnapshot = (data: EditTransactionFormData): string =>
  JSON.stringify({
    type: data.type,
    description: data.description,
    amount: data.amount,
    date: data.date,
    dueDate: data.dueDate,
    status: data.status,
    clientId: data.clientId || "",
    clientName: data.clientName,
    category: data.category,
    wallet: data.wallet,
    notes: data.notes,
    isInstallment: data.isInstallment,
    isRecurring: data.isRecurring,
    installmentCount: data.installmentCount,
    installmentInterval: data.installmentInterval,
    paymentMode: data.paymentMode,
    installmentValue: data.installmentValue,
    firstInstallmentDate: data.firstInstallmentDate,
    installmentsWallet: data.installmentsWallet,
    downPaymentEnabled: data.downPaymentEnabled,
    downPaymentType: data.downPaymentType,
    downPaymentPercentage: data.downPaymentPercentage,
    downPaymentValue: data.downPaymentValue,
    downPaymentWallet: data.downPaymentWallet,
    downPaymentDueDate: data.downPaymentDueDate,
  });

function resolveWalletId(value: string, walletList: Wallet[]): string {
  if (!value || walletList.length === 0) return value;
  if (walletList.find((w) => w.id === value)) return value;
  const byName = walletList.find((w) => w.name === value);
  return byName ? byName.id : value;
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
  const [extraTransactionIds, setExtraTransactionIds] = React.useState<
    string[]
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
    isRecurring: false,
    installmentCount: 1,
    installmentInterval: 1,
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
  const [initialSnapshot, setInitialSnapshot] = React.useState<string | null>(
    null,
  );

  const { wallets } = useWalletsData();
  const walletsRef = React.useRef<Wallet[]>([]);
  const pendingWalletResolution = React.useRef<{
    wallet: string;
    installmentsWallet: string;
    downPaymentWallet: string;
  } | null>(null);

  // Sync wallets ref and apply deferred wallet resolution
  React.useEffect(() => {
    walletsRef.current = wallets;
    if (!pendingWalletResolution.current || wallets.length === 0) return;

    const { wallet, installmentsWallet, downPaymentWallet } =
      pendingWalletResolution.current;
    pendingWalletResolution.current = null;

    const rW = resolveWalletId(wallet, wallets);
    const rIW = resolveWalletId(installmentsWallet, wallets);
    const rDW = resolveWalletId(downPaymentWallet, wallets);

    setFormData((prev) => ({
      ...prev,
      wallet: rW,
      installmentsWallet: rIW,
      downPaymentWallet: rDW,
    }));
    setInitialSnapshot((prev) => {
      if (!prev) return null;
      const snap = JSON.parse(prev) as EditTransactionFormData;
      return buildEditTransactionSnapshot({
        ...snap,
        wallet: rW,
        installmentsWallet: rIW,
        downPaymentWallet: rDW,
      });
    });
  }, [wallets]);

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
      setInitialSnapshot(null);

      const data = await TransactionService.getTransactionById(transactionId);
      // Ensure numeric fields are strings for the form
      const safeData = {
        ...data,
      } as ExtendedTransaction;

      setTransaction(safeData);

      let groupTransactions: Transaction[] = [];

      // If it's an installment or recurring, fetch related ones
      const groupId = safeData.installmentGroupId || safeData.recurringGroupId;
      if (
        groupId &&
        groupId !== "stub-group-id" &&
        (safeData.isInstallment ||
          safeData.isDownPayment ||
          safeData.isRecurring ||
          !!safeData.installmentGroupId)
      ) {
        try {
          // For recurring, query by recurringGroupId since installmentGroupId is null
          let group: Transaction[];
          if (safeData.isRecurring && safeData.recurringGroupId) {
            const allTenantTransactions =
              await TransactionService.getTransactions(safeData.tenantId);
            group = allTenantTransactions
              .filter((t) => t.recurringGroupId === safeData.recurringGroupId)
              .sort(
                (a: Transaction, b: Transaction) =>
                  (a.installmentNumber || 0) - (b.installmentNumber || 0),
              );
          } else {
            group = await TransactionService.getInstallmentsByGroupId(
              groupId,
              safeData.tenantId,
            );
          }
          // Sort by installment number
          groupTransactions = group.sort(
            (a: Transaction, b: Transaction) =>
              (a.installmentNumber || 0) - (b.installmentNumber || 0),
          );

          // Include likely orphan down payment (legacy inconsistent data) so backend can reattach it atomically.
          const allTenantTransactions = safeData.isRecurring
            ? await TransactionService.getTransactions(safeData.tenantId)
            : await TransactionService.getTransactions(safeData.tenantId);
          const orphanCandidates = allTenantTransactions.filter((t) =>
            isLikelyOrphanDownPaymentForGroup(t, safeData),
          );
          if (orphanCandidates.length === 1) {
            groupTransactions = [
              ...groupTransactions,
              orphanCandidates[0],
            ].sort(
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
        // Even without a group ID, check for orphan down payments linked to this transaction.
        // This handles "entrada + sem parcelamento" where installmentGroupId was lost on the main tx.
        try {
          if (!safeData.isDownPayment && !safeData.isInstallment && !safeData.isRecurring) {
            const allTenantTransactions = await TransactionService.getTransactions(safeData.tenantId);
            const orphanDownPayments = allTenantTransactions.filter((t) =>
              isLikelyOrphanDownPaymentForGroup(t, safeData),
            );
            if (orphanDownPayments.length === 1) {
              setRelatedInstallments([orphanDownPayments[0], safeData]);
              setExtraTransactionIds([orphanDownPayments[0].id]);
              groupTransactions = [orphanDownPayments[0], safeData];
            } else {
              setRelatedInstallments([]);
              setExtraTransactionIds([]);
            }
          } else {
            setRelatedInstallments([]);
            setExtraTransactionIds([]);
          }
        } catch (error) {
          console.error("Error checking for orphan down payments:", error);
          setRelatedInstallments([]);
          setExtraTransactionIds([]);
        }
      }

      // DERIVE FORM STATE FROM GROUP (if exists) OR SINGLE TRANSACTION
      const downPaymentItem = groupTransactions.find((t) => t.isDownPayment);
      const regularInstallments = groupTransactions.filter(
        (t) => !t.isDownPayment,
      );

      // Determine if we should treat this as an installment group edit
      const hasGroup = groupTransactions.length > 0;

      // Calculate Total Amount
      // If it's a group (installments), sum everyone (including down payment)
      // If single or recurring, just use safeData.amount (the base value)
      const totalAmount =
        hasGroup && !safeData.isRecurring
          ? groupTransactions.reduce((sum, t) => sum + t.amount, 0)
          : safeData.amount;

      // Installment Count:
      // If group, count regular installments.
      // If single or recurring, use safeData.installmentCount
      const instCount =
        hasGroup && !safeData.isRecurring
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

      const initialFormData: EditTransactionFormData = {
        type: safeData.type,
        description: safeData.description,
        amount: totalAmount.toFixed(2),
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
        isInstallment: safeData.isRecurring
          ? false
          : regularInstallments.length > 1 || (safeData.isInstallment ?? false),
        isRecurring: safeData.isRecurring ?? false,
        installmentCount: instCount > 0 ? instCount : 1,
        installmentInterval:
          (hasGroup
            ? firstRegular?.installmentInterval
            : safeData.installmentInterval) || 1,
        paymentMode: safeData.paymentMode || "total",
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
        firstInstallmentDate: firstRegular?.dueDate
          ? firstRegular.dueDate.split("T")[0]
          : safeData.dueDate
            ? safeData.dueDate.split("T")[0]
            : safeData.date
              ? safeData.date.split("T")[0]
              : "",
      };

      // Resolve wallet NAME → ID (backward compat: old data stored wallet names)
      const currentWallets = walletsRef.current;
      const resolvedWallet = resolveWalletId(initialFormData.wallet, currentWallets);
      const resolvedInstallmentsWallet = resolveWalletId(initialFormData.installmentsWallet, currentWallets);
      const resolvedDownPaymentWallet = resolveWalletId(initialFormData.downPaymentWallet, currentWallets);

      if (currentWallets.length === 0 && (initialFormData.wallet || initialFormData.installmentsWallet || initialFormData.downPaymentWallet)) {
        pendingWalletResolution.current = {
          wallet: initialFormData.wallet,
          installmentsWallet: initialFormData.installmentsWallet,
          downPaymentWallet: initialFormData.downPaymentWallet,
        };
      } else {
        pendingWalletResolution.current = null;
      }

      const resolvedInitialFormData: EditTransactionFormData = {
        ...initialFormData,
        wallet: resolvedWallet,
        installmentsWallet: resolvedInstallmentsWallet,
        downPaymentWallet: resolvedDownPaymentWallet,
      };

      setFormData((prev) => ({
        ...prev,
        ...resolvedInitialFormData,
      }));
      setInitialSnapshot(buildEditTransactionSnapshot(resolvedInitialFormData));
    } catch (error) {
      console.error("Error fetching transaction:", error);
      toast.error("Erro ao carregar lançamento.");
      router.push("/transactions");
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
          firstInstallmentDate: formData.dueDate || formData.date, // Default
          isInstallment: formData.isRecurring ? false : true,
          isRecurring: formData.isRecurring,
          installmentCount: count,
          installmentInterval: formData.installmentInterval || 1,
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
          dueDate:
            formData.firstInstallmentDate || formData.dueDate || formData.date,
          // Keep these for potential switch back
          isInstallment: formData.isRecurring ? false : true,
          isRecurring: formData.isRecurring,
          installmentCount: count,
          installmentInterval: formData.installmentInterval || 1,
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
            isRecurring:
              targetBuffer.isRecurring ?? computedValues.isRecurring ?? false,
            installmentCount:
              targetBuffer.installmentCount ??
              computedValues.installmentCount ??
              1,
            installmentInterval:
              targetBuffer.installmentInterval ??
              computedValues.installmentInterval ??
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
            isRecurring:
              targetBuffer.isRecurring ?? computedValues.isRecurring ?? false,
            installmentCount:
              targetBuffer.installmentCount ??
              computedValues.installmentCount ??
              1,
            installmentInterval:
              targetBuffer.installmentInterval ??
              computedValues.installmentInterval ??
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
    const transactionLabel = formData.description.trim()
      ? `"${formData.description.trim()}"`
      : `ID ${transaction.id}`;

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
        isInstallment: formData.isInstallment && !formData.isRecurring,
        isRecurring: formData.isRecurring,
        installmentCount: formData.isRecurring ? 60 : formData.installmentCount,
        installmentInterval: formData.installmentInterval || 1,
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

      toast.success(`Lancamento ${transactionLabel} atualizado com sucesso.`, {
        title: "Sucesso ao editar",
      });
      router.push("/transactions");
    } catch (error) {
      console.error("Error updating transaction:", error);
      const errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha inesperada ao editar o lancamento.";
      toast.error(
        `Não foi possível editar o lançamento ${transactionLabel}. Detalhes: ${errorMessage}`,
        { title: "Erro ao editar" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = React.useMemo(() => {
    if (!initialSnapshot) return false;

    return buildEditTransactionSnapshot(formData) !== initialSnapshot;
  }, [formData, initialSnapshot]);

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
    hasChanges,
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
