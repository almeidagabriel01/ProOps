export interface CreateTransactionDTO {
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: "income" | "expense";
  status: "paid" | "pending" | "overdue";
  dueDate?: string;
  clientId?: string;
  clientName?: string;
  proposalId?: string;
  category?: string;
  wallet?: string;
  targetTenantId?: string;
  
  // Down Payment / Installments
  isDownPayment?: boolean;
  downPaymentType?: string;
  downPaymentPercentage?: number;
  
  isInstallment?: boolean;
  installmentCount?: number;
  installmentNumber?: number;
  installmentGroupId?: string;
  
  notes?: string;
  extraCosts?: any[];
}

export const validateTransactionData = (data: Partial<CreateTransactionDTO>) => {
  if (
    !data.description ||
    !data.amount ||
    !data.date ||
    !data.type ||
    !data.status
  ) {
    return { 
      isValid: false, 
      message: "Campos obrigatórios faltando: description, amount, date, type, status." 
    };
  }
  
  if (data.amount <= 0 && data.type !== 'expense') { 
     // While technically amount could be negative in some apps, usually for transaction it's absolute value + type.
     // But let's keep it simple and just check required fields for now matching original controller logic.
     // Original logic: just checks falsy values.
  }

  return { isValid: true, message: "" };
};
