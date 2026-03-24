"use client";

import * as React from "react";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import {
  TransactionService,
  TransactionType,
  TransactionStatus,
} from "@/services/transaction-service";
import { useTenant } from "@/providers/tenant-provider";
import { useClientActions } from "@/hooks/useClientActions";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useFormValidation, FormErrors } from "@/hooks/useFormValidation";
import { transactionSchema } from "@/lib/validations";
import { useWalletsData } from "@/app/wallets/_hooks/useWalletsData";
import { getTodayISO } from "@/utils/date-utils";

export type PaymentMode = "total" | "installmentValue";

export interface TransactionFormData {
  type: TransactionType;
  description: string;
  amount: string;
  date: string;
  dueDate: string;
  status: TransactionStatus;
  clientId: string;
  clientName: string;
  category: string;
  wallet: string;
  isInstallment: boolean;
  isRecurring: boolean;
  installmentCount: number;
  notes: string;
  // New fields for advanced payment mode
  paymentMode: PaymentMode;
  installmentValue: string;
  firstInstallmentDate: string;
  installmentsWallet: string;
  downPaymentEnabled: boolean;
  downPaymentType: "value" | "percentage";
  downPaymentPercentage: string;
  downPaymentValue: string;
  downPaymentWallet: string;
  downPaymentDueDate: string;
  installmentInterval: number; // New field for interval between installments
}

const initialFormData: TransactionFormData = {
  type: "income",
  description: "",
  amount: "",
  date: "",
  dueDate: "",
  status: "pending",
  clientId: "",
  clientName: "",
  category: "",
  wallet: "",
  isInstallment: false,
  isRecurring: false,
  installmentCount: 2,
  notes: "",
  // New fields defaults
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
  installmentInterval: 1, // Default to 1 month (Mensal)
};

// Helpers
const getTotalFields = (data: TransactionFormData) => ({
  amount: data.amount,
  wallet: data.wallet,
  dueDate: data.dueDate,
  isInstallment: data.isInstallment,
  isRecurring: data.isRecurring,
  installmentCount: data.installmentCount,
  downPaymentEnabled: data.downPaymentEnabled,
  downPaymentType: data.downPaymentType,
  downPaymentPercentage: data.downPaymentPercentage,
  downPaymentValue: data.downPaymentValue,
  downPaymentWallet: data.downPaymentWallet,
  downPaymentDueDate: data.downPaymentDueDate,
  installmentInterval: data.installmentInterval,
});

const getInstallmentFields = (data: TransactionFormData) => ({
  installmentValue: data.installmentValue,
  installmentsWallet: data.installmentsWallet,
  firstInstallmentDate: data.firstInstallmentDate,
  isInstallment: data.isInstallment,
  isRecurring: data.isRecurring,
  installmentCount: data.installmentCount,
  downPaymentEnabled: data.downPaymentEnabled,
  downPaymentType: data.downPaymentType,
  downPaymentPercentage: data.downPaymentPercentage,
  downPaymentValue: data.downPaymentValue,
  downPaymentWallet: data.downPaymentWallet,
  downPaymentDueDate: data.downPaymentDueDate,
  installmentInterval: data.installmentInterval,
});

interface UseTransactionFormReturn {
  formData: TransactionFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransactionFormData>>;
  handleChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  handleBlur: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  handleClientChange: (data: {
    clientId?: string;
    clientName: string;
    isNew: boolean;
  }) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  errors: FormErrors<TransactionFormData>;
  setFieldError: (name: string, message: string) => void;
  isSaving: boolean;
  canCreate: boolean;
  isLoading: boolean;
  isTransactionLoading?: boolean;
  switchPaymentMode: (mode: "total" | "installmentValue") => void;
}

export function useTransactionForm(): UseTransactionFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreate, isLoading: permLoading } =
    usePagePermission("transactions");
  const { createClient } = useClientActions();
  const [formData, setFormData] = React.useState<TransactionFormData>(() => {
    return {
      ...initialFormData,
      date: getTodayISO(),
    };
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const {
    errors,
    validateForm,
    clearFieldError,
    validateField,
    setFieldError,
  } = useFormValidation({
    schema: transactionSchema,
  });

  const { wallets } = useWalletsData();

  const getDownPaymentAmount = React.useCallback(
    (data: TransactionFormData) => {
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

  // Dual Buffer for creation too
  const [modeBuffers, setModeBuffers] = React.useState<{
    total: Partial<TransactionFormData>;
    installmentValue: Partial<TransactionFormData>;
  }>({
    total: {},
    installmentValue: {},
  });

  const switchPaymentMode = (newMode: "total" | "installmentValue") => {
    if (newMode === formData.paymentMode) return;

    const currentMode = formData.paymentMode;
    const currentFields =
      currentMode === "total"
        ? getTotalFields(formData)
        : getInstallmentFields(formData);

    setModeBuffers((prev) => ({
      ...prev,
      [currentMode]: currentFields,
    }));

    // Hybrid Sync Logic:
    // If target buffer is empty (never visited or cleared), calculate default values from current mode.
    // If target buffer has data (user visited and edited), use it (persist).

    const targetBuffer = modeBuffers[newMode];
    const isTargetEmpty =
      newMode === "total"
        ? !targetBuffer.amount
        : !targetBuffer.installmentValue;

    let computedValues: Partial<TransactionFormData> = {};

    if (isTargetEmpty) {
      if (newMode === "installmentValue") {
        // Total -> Installment
        // Default: Split remaining total (after down payment) by installment count
        const total = parseFloat(formData.amount || "0");
        const downPayment = getDownPaymentAmount(formData);
        const count = formData.installmentCount || 1;
        const remaining = Math.max(0, total - downPayment);
        const installmentVal =
          count > 0 ? (remaining / count).toFixed(2) : "0.00";

        computedValues = {
          installmentValue: installmentVal,
          installmentsWallet: formData.wallet, // Propagate wallet
          firstInstallmentDate: formData.dueDate || formData.date, // Default to due date or transaction date
          isInstallment: formData.isRecurring ? false : true,
          isRecurring: formData.isRecurring,
          installmentCount: count,
          downPaymentEnabled: formData.downPaymentEnabled,
          downPaymentType: formData.downPaymentType,
          downPaymentPercentage: formData.downPaymentPercentage,
          downPaymentValue: formData.downPaymentValue,
          downPaymentWallet: formData.wallet, // Default to main wallet
          downPaymentDueDate: formData.date,
          installmentInterval: formData.installmentInterval || 1,
        };
      } else {
        // Installment -> Total
        // Default: Sum installments + down payment
        const instVal = parseFloat(formData.installmentValue || "0");
        const count = formData.installmentCount || 1;
        const downPayment = getDownPaymentAmount(formData);
        const total = instVal * count + downPayment;

        computedValues = {
          amount: total.toFixed(2),
          wallet: formData.installmentsWallet || formData.wallet, // Try to keep some wallet
          dueDate:
            formData.firstInstallmentDate || formData.dueDate || formData.date,
          // Keep installment settings in case we switch back
          isInstallment: formData.isRecurring ? false : true,
          isRecurring: formData.isRecurring,
          installmentCount: count,
          downPaymentEnabled: formData.downPaymentEnabled,
          downPaymentType: formData.downPaymentType,
          downPaymentPercentage: formData.downPaymentPercentage,
          downPaymentValue: formData.downPaymentValue,
          downPaymentWallet: formData.downPaymentWallet,
          downPaymentDueDate: formData.downPaymentDueDate,
          installmentInterval: formData.installmentInterval || 1,
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

            // Clear Installment Mode Fields
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

            // Clear Total Mode Fields
            amount: "",
            wallet: "",
            dueDate: "",
          }),
    }));
  };

  React.useEffect(() => {
    if (!permLoading && !canCreate) {
      router.push("/transactions");
    }
  }, [permLoading, canCreate, router]);

  // Pre-select default wallet
  React.useEffect(() => {
    if (formData.wallet || wallets.length === 0) return;

    const defaultWallet = wallets.find((w) => w.isDefault);
    if (defaultWallet) {
      setFormData((prev) => ({ ...prev, wallet: defaultWallet.name }));
      // Also clear error if any
      if (errors.wallet) {
        clearFieldError("wallet");
      }
    }
  }, [wallets, formData.wallet, errors.wallet, clearFieldError]);

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
    // Clear error when user starts typing
    if (errors[name as keyof typeof errors]) {
      clearFieldError(name as keyof TransactionFormData);
    }
  };

  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    validateField(name as keyof TransactionFormData, value, formData);
  };

  const handleClientChange = (data: {
    clientId?: string;
    clientName: string;
    isNew: boolean;
  }) => {
    setFormData((prev) => ({
      ...prev,
      clientId: data.clientId ?? "",
      clientName: data.clientName,
    }));
    // Clear client errors when user selects a client
    if (data.clientId || data.clientName) {
      clearFieldError("clientId" as keyof TransactionFormData);
      clearFieldError("clientName" as keyof TransactionFormData);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submit
    if (!validateForm(formData)) {
      return;
    }

    if (!tenant) {
      toast.error("Erro: Nenhuma empresa selecionada!");
      return;
    }

    setIsSaving(true);
    const transactionLabel = formData.description.trim()
      ? `"${formData.description.trim()}"`
      : "sem descricao";

    try {
      let clientId = formData.clientId;
      if (!clientId && formData.clientName.trim()) {
        const newClientResult = await createClient({
          name: formData.clientName,
          source: "financial",
        });

        if (newClientResult?.success && newClientResult.clientId) {
          clientId = newClientResult.clientId;
        } else {
          setIsSaving(false);
          return;
        }
      }

      const now = new Date().toISOString();
      let finalAmount: number;
      let installmentGroupId: string | undefined = undefined;
      let walletToUse: string;
      let dueDateToUse: string | undefined;
      const downPaymentAmount = getDownPaymentAmount(formData);

      // Logic to determine initial creation values
      if (formData.paymentMode === "installmentValue") {
        // Installment Value mode
        const installmentValue = parseFloat(formData.installmentValue || "0");
        finalAmount = installmentValue;
        walletToUse = formData.installmentsWallet || formData.wallet;
        dueDateToUse = formData.firstInstallmentDate || formData.dueDate;
      } else {
        // Total mode
        const totalAmount = parseFloat(formData.amount);
        const downPayment = downPaymentAmount;

        let remainingAmount = totalAmount;

        if (formData.downPaymentEnabled && downPayment > 0) {
          remainingAmount = totalAmount - downPayment;
        }

        const count = formData.isInstallment ? formData.installmentCount : 1;
        // Round once to cents so all generated installments keep the same value.
        finalAmount = parseFloat((remainingAmount / count).toFixed(2));

        walletToUse = formData.wallet;
        dueDateToUse = formData.dueDate;
      }

      // Generate Group ID
      const submitDbCount = formData.isRecurring
        ? 1
        : formData.installmentCount;
      if (
        (formData.isInstallment && submitDbCount >= 1) ||
        (formData.isRecurring && submitDbCount >= 1) ||
        (formData.downPaymentEnabled && downPaymentAmount > 0)
      ) {
        installmentGroupId = `installment_${Date.now()}`;
      }

      // 1. Create Down Payment (if any)
      if (
        formData.downPaymentEnabled &&
        downPaymentAmount > 0 &&
        installmentGroupId
      ) {
        await TransactionService.createTransaction({
          tenantId: tenant.id,
          type: formData.type,
          description: formData.description.trim(),
          amount: downPaymentAmount,
          date: formData.date,
          dueDate: formData.downPaymentDueDate || formData.date,
          status: formData.status,
          clientId,
          clientName: formData.clientName || undefined,
          category: formData.category || undefined,
          wallet: formData.downPaymentWallet || walletToUse,
          isInstallment: false,
          isRecurring: false,
          isDownPayment: true,
          downPaymentType: formData.downPaymentType,
          downPaymentPercentage:
            formData.downPaymentType === "percentage"
              ? parseFloat(formData.downPaymentPercentage || "0")
              : 0,
          installmentNumber: 0,
          installmentCount: submitDbCount + 1,
          installmentGroupId,
          installmentInterval: formData.installmentInterval || 1,
          paymentMode: formData.paymentMode,
          notes: formData.notes || undefined,
          createdAt: now,
          updatedAt: now,
        });
      }

      // 2. Create Installments (Backend Generator)
      await TransactionService.createTransaction({
        tenantId: tenant.id,
        type: formData.type,
        description: formData.description.trim(),
        amount: finalAmount,
        date: formData.date,
        dueDate: dueDateToUse || undefined,
        status: formData.status,
        clientId,
        clientName: formData.clientName || undefined,
        category: formData.category || undefined,
        wallet: walletToUse || undefined,
        isInstallment: formData.isInstallment && !formData.isRecurring,
        isRecurring: formData.isRecurring,
        installmentCount: submitDbCount,
        installmentGroupId: formData.isInstallment
          ? installmentGroupId
          : undefined,
        recurringGroupId: formData.isRecurring ? installmentGroupId : undefined,
        installmentInterval: formData.installmentInterval || 1,
        paymentMode: formData.paymentMode,
        notes: formData.notes || undefined,
        createdAt: now,
        updatedAt: now,
      });

      toast.success(`Lancamento ${transactionLabel} criado com sucesso.`, {
        title: "Sucesso ao criar",
      });
      router.push("/transactions");
    } catch (error) {
      console.error("Error creating transaction:", error);
      const errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Falha inesperada ao criar o lancamento.";
      toast.error(
        `Não foi possível criar o lançamento ${transactionLabel}. Detalhes: ${errorMessage}`,
        { title: "Erro ao criar" },
      );
    } finally {
      setIsSaving(false);
    }
  };

  return {
    formData,
    setFormData,
    handleChange,
    handleBlur,
    handleClientChange,
    handleSubmit,
    errors,
    setFieldError: setFieldError as (name: string, message: string) => void,
    isSaving,
    canCreate,
    isLoading: permLoading,
    switchPaymentMode,
  };
}
