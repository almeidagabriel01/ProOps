import type { Firestore } from "firebase-admin/firestore";

export interface SeedTransaction {
  id: string;
  tenantId: string;
  type: "income" | "expense";
  status: "paid" | "pending" | "overdue";
  amount: number;
  description: string;
  walletId: string;
  categoryId?: string;
  dueDate: string;
  paymentDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isInstallment?: boolean;
  installmentTotal?: number;
  installmentCurrent?: number;
}

export const TRANSACTION_ALPHA_INCOME: SeedTransaction = {
  id: "transaction-alpha-income",
  tenantId: "tenant-alpha",
  type: "income",
  status: "paid",
  amount: 8300.0,
  description: "Pagamento Proposta - Retrofit Escritório Central",
  walletId: "wallet-alpha-main",
  dueDate: new Date("2024-06-10T00:00:00Z").toISOString(),
  paymentDate: new Date("2024-06-10T14:30:00Z").toISOString(),
  createdAt: new Date("2024-06-01T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-06-10T14:30:00Z").toISOString(),
  createdBy: "user-admin-alpha",
};

export const TRANSACTION_ALPHA_EXPENSE: SeedTransaction = {
  id: "transaction-alpha-expense",
  tenantId: "tenant-alpha",
  type: "expense",
  status: "pending",
  amount: 1500.0,
  description: "Compra de Materiais - Sensores",
  walletId: "wallet-alpha-main",
  dueDate: new Date("2024-06-20T00:00:00Z").toISOString(),
  createdAt: new Date("2024-06-05T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-06-05T00:00:00Z").toISOString(),
  createdBy: "user-admin-alpha",
};

export const TRANSACTION_ALPHA_INSTALLMENT: SeedTransaction = {
  id: "transaction-alpha-installment",
  tenantId: "tenant-alpha",
  type: "income",
  status: "pending",
  amount: 1200.0,
  description: "Parcela 1/3 - Projeto Condomínio Alfa",
  walletId: "wallet-alpha-savings",
  dueDate: new Date("2024-07-01T00:00:00Z").toISOString(),
  createdAt: new Date("2024-06-06T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-06-06T00:00:00Z").toISOString(),
  createdBy: "user-admin-alpha",
  isInstallment: true,
  installmentTotal: 3,
  installmentCurrent: 1,
};

export const TRANSACTION_BETA_INCOME: SeedTransaction = {
  id: "transaction-beta-income",
  tenantId: "tenant-beta",
  type: "income",
  status: "paid",
  amount: 1260.0,
  description: "Venda Cortinas Sala de Estar",
  walletId: "wallet-beta-main",
  dueDate: new Date("2024-06-15T00:00:00Z").toISOString(),
  paymentDate: new Date("2024-06-15T10:00:00Z").toISOString(),
  createdAt: new Date("2024-06-10T00:00:00Z").toISOString(),
  updatedAt: new Date("2024-06-15T10:00:00Z").toISOString(),
  createdBy: "user-admin-beta",
};

const ALL_TRANSACTIONS: SeedTransaction[] = [
  TRANSACTION_ALPHA_INCOME,
  TRANSACTION_ALPHA_EXPENSE,
  TRANSACTION_ALPHA_INSTALLMENT,
  TRANSACTION_BETA_INCOME,
];

export async function seedTransactions(db: Firestore): Promise<void> {
  const batch = db.batch();

  for (const transaction of ALL_TRANSACTIONS) {
    batch.set(db.collection("transactions").doc(transaction.id), transaction);
  }

  await batch.commit();
  console.log("[seed] Transactions created: 3 for tenant-alpha (income-paid/expense-pending/installment), 1 for tenant-beta");
}
