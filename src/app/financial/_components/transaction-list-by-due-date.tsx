"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { formatCurrency } from "@/utils/format";
import { statusConfig } from "../_constants/config";
import {
  Check,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Eye,
  Trash2,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";

interface TransactionListByDueDateProps {
  transactions: Transaction[];
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (transaction: Transaction) => void;
  onStatusChange?: (
    transaction: Transaction,
    newStatus: TransactionStatus,
    updateAll?: boolean,
  ) => Promise<boolean>;
  onUpdate?: (
    transaction: Transaction,
    data: Partial<Transaction>,
  ) => Promise<boolean>;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleSelectAll: () => void;
}

const statusOptions: {
  value: TransactionStatus;
  label: string;
  icon: typeof Check;
}[] = [
  { value: "paid", label: "Pago", icon: Check },
  { value: "pending", label: "Pendente", icon: Clock },
  { value: "overdue", label: "Atrasado", icon: AlertTriangle },
];

export function TransactionListByDueDate({
  transactions,
  canEdit,
  canDelete,
  onDelete,
  onStatusChange,
  selectedIds,
  onToggleSelection,
  onToggleSelectAll,
}: TransactionListByDueDateProps) {
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const handleStatusChange = async (
    transaction: Transaction,
    newStatus: TransactionStatus,
  ) => {
    if (!onStatusChange || transaction.status === newStatus) return;
    setUpdatingId(transaction.id);
    await onStatusChange(transaction, newStatus, false);
    setUpdatingId(null);
  };

  const isAllSelected =
    transactions.length > 0 && selectedIds.size === transactions.length;
  const isSomeSelected =
    selectedIds.size > 0 && selectedIds.size < transactions.length;

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const datePart = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;
    const parts = datePart.split("-").map(Number);
    if (parts.length !== 3) return dateString;
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  const getTypeColor = (transaction: Transaction) => {
    if (transaction.type === "income") return "text-green-500";
    return "text-red-500";
  };

  return (
    <Card>
      <CardContent className="p-0">
        {/* Table Header */}
        <div className="grid grid-cols-[32px_1fr_100px_100px_100px_80px] gap-4 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={isAllSelected}
              ref={(el) => {
                if (el) {
                  (el as unknown as HTMLInputElement).indeterminate =
                    isSomeSelected;
                }
              }}
              onCheckedChange={onToggleSelectAll}
              className="cursor-pointer"
            />
          </div>
          <div>Descrição</div>
          <div className="text-center">Vencimento</div>
          <div className="text-center">Valor</div>
          <div className="text-center">Status</div>
          <div className="text-center">Ações</div>
        </div>

        {/* Table Rows */}
        <div className="divide-y">
          {transactions.map((transaction) => {
            const isUpdating = updatingId === transaction.id;
            const statusInfo = statusConfig[transaction.status];
            const isSelected = selectedIds.has(transaction.id);

            return (
              <div
                key={transaction.id}
                className={`grid grid-cols-[32px_1fr_100px_100px_100px_80px] gap-4 px-4 py-2.5 items-center hover:bg-muted/30 transition-colors text-sm ${
                  isSelected ? "bg-primary/5" : ""
                }`}
              >
                {/* Checkbox */}
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSelection(transaction.id)}
                    className="cursor-pointer"
                  />
                </div>

                {/* Description */}
                <div className="flex items-center gap-2 min-w-0">
                  {transaction.type === "income" ? (
                    <ArrowUpCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : (
                    <ArrowDownCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                  <span className="truncate">{transaction.description}</span>
                  {transaction.isInstallment && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({transaction.installmentNumber}/
                      {transaction.installmentCount})
                    </span>
                  )}
                  {transaction.isDownPayment && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1 shrink-0"
                    >
                      Entrada
                    </Badge>
                  )}
                </div>

                {/* Due Date */}
                <div className="text-center text-xs text-muted-foreground">
                  {formatDate(transaction.dueDate || transaction.date)}
                </div>

                {/* Amount */}
                <div
                  className={`text-center font-medium ${getTypeColor(transaction)}`}
                >
                  {transaction.type === "expense" ? "-" : ""}
                  {formatCurrency(transaction.amount)}
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  {canEdit && onStatusChange ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-2 text-xs border"
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              {(() => {
                                const opt = statusOptions.find(
                                  (o) => o.value === transaction.status,
                                );
                                const Icon = opt?.icon || Check;
                                return <Icon className="h-3 w-3" />;
                              })()}
                              <span>
                                {statusConfig[transaction.status].label}
                              </span>
                              <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[120px]">
                        {statusOptions.map((option) => (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={() =>
                              handleStatusChange(transaction, option.value)
                            }
                            className="gap-2 cursor-pointer text-xs"
                          >
                            <option.icon className="h-3 w-3" />
                            <span>{option.label}</span>
                            {transaction.status === option.value && (
                              <Check className="h-3 w-3 ml-auto opacity-50" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge
                      variant={statusInfo.variant}
                      className="text-[10px] h-5"
                    >
                      {statusInfo.label}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-center gap-0.5">
                  <Link href={`/financial/${transaction.id}/view`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Ver"
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                  </Link>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => onDelete(transaction)}
                      title="Excluir"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
