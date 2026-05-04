import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { TransactionType, TransactionStatus } from "@/services/transaction-service";

export const typeConfig: Record<
  TransactionType,
  { label: string; icon: typeof ArrowUpCircle; color: string }
> = {
  income: { label: "Receita", icon: ArrowUpCircle, color: "text-green-500" },
  expense: { label: "Despesa", icon: ArrowDownCircle, color: "text-red-500" },
};

export const statusConfig: Record<
  TransactionStatus,
  {
    label: string;
    variant: "default" | "destructive" | "outline" | "success" | "warning";
  }
> = {
  paid: { label: "Pago", variant: "success" },
  pending: { label: "Pendente", variant: "warning" },
  overdue: { label: "Atrasado", variant: "destructive" },
};
