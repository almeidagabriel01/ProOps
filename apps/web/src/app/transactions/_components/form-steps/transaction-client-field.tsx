"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { ClientSelect } from "@/components/features/client-select";
import { FormErrors } from "@/hooks/useFormValidation";
import { User } from "lucide-react";
import { TransactionFormData } from "../../_hooks/useTransactionForm";

interface TransactionClientFieldProps {
  formData: TransactionFormData;
  onClientChange: (data: {
    clientId?: string;
    clientName: string;
    isNew: boolean;
  }) => void;
  errors?: FormErrors<TransactionFormData>;
}

/** Cliente (receita, obrigatório) ou fornecedor (despesa) do lançamento. */
export function TransactionClientField({
  formData,
  onClientChange,
  errors = {},
}: TransactionClientFieldProps) {
  const isIncome = formData.type === "income";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-muted-foreground" />
        <Label className="text-sm font-medium">
          {isIncome ? "Cliente" : "Fornecedor"}{" "}
          {isIncome && <span className="text-destructive">*</span>}
        </Label>
      </div>
      <ClientSelect
        value={formData.clientName}
        clientId={formData.clientId}
        onChange={onClientChange}
        error={!!errors.clientId || !!errors.clientName}
      />
      {(errors.clientId || errors.clientName) && (
        <p className="text-sm text-destructive">
          {errors.clientId || errors.clientName}
        </p>
      )}
    </div>
  );
}
