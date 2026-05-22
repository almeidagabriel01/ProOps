export type TransactionWritableStatus = "paid" | "pending";
export const WRITABLE_STATUSES: ReadonlySet<TransactionWritableStatus> = new Set([
  "paid",
  "pending",
]);

export function isWritableStatus(value: unknown): value is TransactionWritableStatus {
  return typeof value === "string" && WRITABLE_STATUSES.has(value as TransactionWritableStatus);
}

export interface CreateTransactionDTO {
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: "income" | "expense";
  status: TransactionWritableStatus;
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
  installmentInterval?: number;
  
  isRecurring?: boolean;
  recurringGroupId?: string;
  paymentMode?: "total" | "installmentValue";
  
  notes?: string;
  extraCosts?: any[];

  // Bundled down payment — created atomically with the main transaction
  downPayment?: {
    amount: number;
    date: string;
    dueDate?: string;
    wallet?: string;
    status: TransactionWritableStatus;
    downPaymentType?: string;
    downPaymentPercentage?: number;
    installmentNumber?: number;
    installmentCount?: number;
    paymentMode?: "total" | "installmentValue";
    notes?: string;
  };
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

  if (data.amount <= 0) {
    return { isValid: false, message: "O valor deve ser maior que zero." };
  }

  if (!isWritableStatus(data.status)) {
    return {
      isValid: false,
      message: "Status inválido. 'Atrasado' é definido automaticamente pelo sistema.",
    };
  }

  if (data.downPayment !== undefined && !isWritableStatus(data.downPayment.status)) {
    return {
      isValid: false,
      message: "Status da entrada deve ser 'Pago' ou 'Pendente'.",
    };
  }

  return { isValid: true, message: "" };
};
