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
    >
  ) => void;
  handleBlur: (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
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
}

export function useTransactionForm(): UseTransactionFormReturn {
  const router = useRouter();
  const { tenant } = useTenant();
  const { canCreate, isLoading: permLoading } = usePagePermission("financial");
  const { createClient } = useClientActions();
  const [formData, setFormData] =
    React.useState<TransactionFormData>(initialFormData);
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
    >
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
    >
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

      if (formData.paymentMode === "installmentValue") {
        // Installment Value mode: calculate total from installments + down payment
        const installmentValue = parseFloat(formData.installmentValue || "0");
        const downPayment = formData.downPaymentEnabled 
          ? parseFloat(formData.downPaymentValue || "0") 
          : 0;
        
        // The final amount per transaction is the installment value
        finalAmount = installmentValue;
        walletToUse = formData.installmentsWallet || formData.wallet;
        dueDateToUse = formData.firstInstallmentDate || formData.dueDate;

        // Always create group ID when there are installments (or installments + down payment)
        if (formData.isInstallment && formData.installmentCount >= 1) {
          installmentGroupId = `installment_${Date.now()}`;
        }

        // Create down payment transaction if enabled (as part of the installment group)
        // NOTE: isInstallment is false to prevent backend from generating installments
        // but we include installmentGroupId to group it with the installments
        if (formData.downPaymentEnabled && downPayment > 0 && installmentGroupId) {
          await TransactionService.createTransaction({
            tenantId: tenant.id,
            type: formData.type,
            description: formData.description.trim(),
            amount: downPayment,
            date: formData.date,
            dueDate: formData.downPaymentDueDate || formData.date,
            status: formData.status,
            clientId,
            clientName: formData.clientName || undefined,
            category: formData.category || undefined,
            wallet: formData.downPaymentWallet || walletToUse,
            isInstallment: false, // Don't generate installments for this
            isDownPayment: true, // Mark as down payment
            installmentNumber: 0, // 0 indicates down payment / entrada
            installmentCount: formData.installmentCount + 1, // Total count including down payment
            installmentGroupId,
            notes: formData.notes || undefined,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Create installment transactions (backend will generate all installments)
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
      } else {
        // Total mode: original logic
        finalAmount = parseFloat(formData.amount);
        walletToUse = formData.wallet;
        dueDateToUse = formData.dueDate;

        if (formData.isInstallment && formData.installmentCount > 1) {
          const total = parseFloat(formData.amount);
          const count = formData.installmentCount;
          finalAmount = Math.round((total / count) * 100) / 100;
          installmentGroupId = `installment_${Date.now()}`;
        }

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
