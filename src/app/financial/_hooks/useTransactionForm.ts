"use client";

import * as React from "react";
import { toast } from "react-toastify";
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
import { useWalletsData } from "../wallets/_hooks/useWalletsData";
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
  installmentCount: number;
  notes: string;
  // New fields for advanced payment mode
  paymentMode: PaymentMode;
  installmentValue: string;
  firstInstallmentDate: string;
  installmentsWallet: string;
  downPaymentEnabled: boolean;
  downPaymentValue: string;
  downPaymentWallet: string;
  downPaymentDueDate: string;
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
  installmentCount: 2,
  notes: "",
  // New fields defaults
  paymentMode: "total",
  installmentValue: "",
  firstInstallmentDate: "",
  installmentsWallet: "",
  downPaymentEnabled: false,
  downPaymentValue: "",
  downPaymentWallet: "",
  downPaymentDueDate: "",
};

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
}

export function useTransactionForm(): UseTransactionFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreate, isLoading: permLoading } = usePagePermission("financial");
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

  React.useEffect(() => {
    if (!permLoading && !canCreate) {
      router.push("/financial");
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
        const downPayment = formData.downPaymentEnabled
          ? parseFloat(formData.downPaymentValue || "0")
          : 0;

        let remainingAmount = totalAmount;

        if (formData.downPaymentEnabled && downPayment > 0) {
          remainingAmount = totalAmount - downPayment;
        }

        const count = formData.isInstallment ? formData.installmentCount : 1;
        // Naive division for INITIAL submission. We will fix it immediately after.
        finalAmount = parseFloat((remainingAmount / count).toFixed(2));

        walletToUse = formData.wallet;
        dueDateToUse = formData.dueDate;
      }

      // Generate Group ID
      if (
        (formData.isInstallment && formData.installmentCount >= 1) ||
        (formData.downPaymentEnabled &&
          parseFloat(formData.downPaymentValue || "0") > 0)
      ) {
        installmentGroupId = `installment_${Date.now()}`;
      }

      // 1. Create Down Payment (if any)
      if (
        formData.downPaymentEnabled &&
        parseFloat(formData.downPaymentValue || "0") > 0 &&
        installmentGroupId
      ) {
        await TransactionService.createTransaction({
          tenantId: tenant.id,
          type: formData.type,
          description: formData.description.trim(),
          amount: parseFloat(formData.downPaymentValue || "0"),
          date: formData.date,
          dueDate: formData.downPaymentDueDate || formData.date,
          status: formData.status,
          clientId,
          clientName: formData.clientName || undefined,
          category: formData.category || undefined,
          wallet: formData.downPaymentWallet || walletToUse,
          isInstallment: false,
          isDownPayment: true,
          installmentNumber: 0,
          installmentCount: formData.installmentCount + 1,
          installmentGroupId,
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
        isInstallment: formData.isInstallment,
        installmentCount: formData.installmentCount,
        installmentGroupId,
        notes: formData.notes || undefined,
        createdAt: now,
        updatedAt: now,
      });

      // 3. POST-CREATION FIX: Distribute Penny Remainder
      // Only needed for Total Mode with Installments to avoid drift
      if (
        formData.paymentMode === "total" &&
        formData.isInstallment &&
        formData.installmentCount > 1 &&
        installmentGroupId
      ) {
        // Fetch the just-created group
        const all = await TransactionService.getTransactions(tenant.id);
        const group = all.filter(
          (t) =>
            t.installmentGroupId === installmentGroupId && !t.isDownPayment,
        );

        if (group.length > 0) {
          const totalAmount = parseFloat(formData.amount);
          const downPayment = formData.downPaymentEnabled
            ? parseFloat(formData.downPaymentValue || "0")
            : 0;
          const targetTotalForInstallments = totalAmount - downPayment;

          // Calculate correct distribution
          const count = group.length;
          const baseAmount =
            Math.floor((targetTotalForInstallments / count) * 100) / 100;
          const totalBase = baseAmount * count;
          const remainder = Math.round(
            (targetTotalForInstallments - totalBase) * 100,
          ); // Cents

          // Update items that need adjustment
          const operations: Promise<unknown>[] = [];

          group.forEach((t, index) => {
            // Sort order check? group from backend might not be sorted by installment number
            // But usually we can just sort roughly or use index if we don't care WHICH month gets the penny
            // Let's sort to be deterministic
            // Actually we need to verify current amounts.

            const shouldBeAmount = baseAmount + (index < remainder ? 0.01 : 0);
            const currentAmount = t.amount;

            if (Math.abs(currentAmount - shouldBeAmount) > 0.001) {
              operations.push(
                TransactionService.updateTransaction(t.id, {
                  amount: parseFloat(shouldBeAmount.toFixed(2)),
                }),
              );
            }
          });

          if (operations.length > 0) {
            await Promise.all(operations);
          }
        }
      }

      toast.success("Lançamento criado com sucesso!");
      router.push("/financial");
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast.error("Erro ao criar lançamento");
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
  };
}
