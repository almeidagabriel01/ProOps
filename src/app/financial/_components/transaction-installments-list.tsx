"use client";

import * as React from "react";
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
  Edit2,
  Banknote,
  CreditCard,
  Wallet,
} from "lucide-react";
import { toast } from "react-toastify";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";

interface TransactionInstallmentsListProps {
  installments: Transaction[];
  onStatusChange: (
    transaction: Transaction,
    newStatus: TransactionStatus,
    updateAll?: boolean,
  ) => Promise<boolean>;
  onUpdate?: (
    transaction: Transaction,
    data: Partial<Transaction>,
  ) => Promise<boolean>;
  canEdit: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
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

export function TransactionInstallmentsList({
  installments,
  onStatusChange,
  onUpdate,
  canEdit,
  selectedIds,
  onToggleSelection,
}: TransactionInstallmentsListProps) {
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<number>(0);
  const [isSaving, setIsSaving] = React.useState(false);

  // Sort installments by number just in case
  const sortedInstallments = React.useMemo(() => {
    return [...installments].sort(
      (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0),
    );
  }, [installments]);

  const handleStatusChange = async (
    transaction: Transaction,
    newStatus: TransactionStatus,
  ) => {
    if (transaction.status === newStatus) return;

    // Validation Logic
    if (newStatus === "paid") {
      // Check if previous installment is paid
      const currentNumber = transaction.installmentNumber || 1;
      if (currentNumber > 1) {
        const prevInstallment = sortedInstallments.find(
          (t) => t.installmentNumber === currentNumber - 1,
        );
        if (prevInstallment && prevInstallment.status !== "paid") {
          toast.warning(
            `A parcela ${currentNumber - 1} precisa estar paga antes de pagar a parcela ${currentNumber}.`,
          );
          return;
        }
      }
    }

    setUpdatingId(transaction.id);
    await onStatusChange(transaction, newStatus, false); // Single update
    setUpdatingId(null);
  };

  const handleEditClick = (installment: Transaction, e: React.MouseEvent) => {
    if (!canEdit || !onUpdate) return;
    e.stopPropagation();
    setEditingId(installment.id);
    setEditValue(installment.amount);
  };

  const handleEditSave = async (installment: Transaction) => {
    if (!onUpdate) return;

    if (Math.abs(editValue - installment.amount) < 0.01) {
      setEditingId(null);
      return;
    }

    if (editValue <= 0) {
      toast.warning("O valor deve ser maior que zero");
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(installment, { amount: editValue });
      setEditingId(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, installment: Transaction) => {
    if (e.key === "Enter") {
      handleEditSave(installment);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";

    // Extract date part if ISO format
    const datePart = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;

    // Parse date parts manually to avoid timezone issues
    const parts = datePart.split("-").map(Number);
    if (parts.length !== 3) return dateString;

    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderStatusBadge = (
    transaction: Transaction,
    statusInfo: (typeof statusConfig)[keyof typeof statusConfig],
    isUpdating: boolean,
  ) => {
    if (canEdit) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-md text-xs font-medium border"
              onClick={(e) => e.stopPropagation()}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Atualizando...</span>
                </>
              ) : (
                <>
                  {(() => {
                    const option = statusOptions.find(
                      (o) => o.value === transaction.status,
                    );
                    const Icon = option?.icon || Check;
                    return <Icon className="h-3 w-3" />;
                  })()}
                  <span>{statusConfig[transaction.status].label}</span>
                  <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[130px]">
            {statusOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleStatusChange(transaction, option.value)}
                className="gap-2 cursor-pointer text-xs"
              >
                <option.icon className="h-3.5 w-3.5" />
                <span>{option.label}</span>
                {transaction.status === option.value && (
                  <Check className="h-3 w-3 ml-auto opacity-50" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Badge variant={statusInfo.variant} className="text-xs">
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <div className="animate-in slide-in-from-top-2 duration-200">
      <div className="flex flex-col gap-2">
        {/* Down Payment Section */}
        {sortedInstallments.some((i) => i.isDownPayment) && (
          <div className="space-y-1">
            {sortedInstallments
              .filter((i) => i.isDownPayment)
              .map((downPayment) => {
                const statusInfo = statusConfig[downPayment.status];
                const isUpdating = updatingId === downPayment.id;

                return (
                  <div
                    key={downPayment.id}
                    className={`flex items-center justify-between py-2 px-3 bg-blue-500/10 rounded-lg border border-blue-500/20 ${selectedIds?.has(downPayment.id) ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      {onToggleSelection && (
                        <Checkbox
                          checked={selectedIds?.has(downPayment.id) || false}
                          onCheckedChange={() =>
                            onToggleSelection(downPayment.id)
                          }
                          className="cursor-pointer"
                        />
                      )}
                      <div className="p-1.5 rounded-full bg-blue-500/20">
                        <Banknote className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">Entrada</div>
                        <div className="text-xs text-muted-foreground">
                          Venc:{" "}
                          {formatDate(downPayment.dueDate || downPayment.date)}
                          {downPayment.wallet && ` • ${downPayment.wallet}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-bold text-blue-500">
                        {formatCurrency(downPayment.amount)}
                      </div>
                      {renderStatusBadge(downPayment, statusInfo, isUpdating)}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Installments Section */}
        {sortedInstallments.some((i) => !i.isDownPayment) && (
          <div className="space-y-1">
            {/* Only show header if there are installments */}
            <div className="flex items-center gap-2 px-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">
                Parcelas (
                {sortedInstallments.filter((i) => !i.isDownPayment).length}x de{" "}
                {formatCurrency(
                  sortedInstallments.find((i) => !i.isDownPayment)?.amount || 0,
                )}
                )
              </span>
            </div>

            <div className="space-y-1.5">
              {sortedInstallments
                .filter((i) => !i.isDownPayment)
                .map((installment) => {
                  const statusInfo = statusConfig[installment.status];
                  const isUpdating = updatingId === installment.id;

                  return (
                    <div
                      key={installment.id}
                      className={`group/row flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border ${selectedIds?.has(installment.id) ? "ring-2 ring-primary" : ""}`}
                    >
                      <div className="flex items-center gap-3">
                        {onToggleSelection && (
                          <Checkbox
                            checked={selectedIds?.has(installment.id) || false}
                            onCheckedChange={() =>
                              onToggleSelection(installment.id)
                            }
                            className="cursor-pointer"
                          />
                        )}
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          {!installment.isInstallment ? (
                            <Wallet className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <span className="text-xs font-bold text-primary">
                              {installment.installmentNumber}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {!installment.isInstallment
                              ? "Restante"
                              : `Parcela ${installment.installmentNumber}/${installment.installmentCount}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Venc:{" "}
                            {formatDate(
                              installment.dueDate || installment.date,
                            )}
                            {installment.wallet && ` • ${installment.wallet}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="font-bold text-primary text-right">
                          {editingId === installment.id ? (
                            <div className="relative">
                              <CurrencyInput
                                value={editValue}
                                onChange={(e) =>
                                  setEditValue(Number(e.target.value))
                                }
                                onKeyDown={(e) => handleKeyDown(e, installment)}
                                autoFocus
                                disabled={isSaving}
                                className="h-7 py-0.5 pr-2 pl-2 w-28 text-right font-medium text-sm bg-background border-primary"
                                onBlur={() => handleEditSave(installment)}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <span>{formatCurrency(installment.amount)}</span>
                              {canEdit && onUpdate && (
                                <button
                                  onClick={(e) =>
                                    handleEditClick(installment, e)
                                  }
                                  className="p-1 hover:bg-muted rounded-full transition-colors flex items-center justify-center cursor-pointer"
                                  title="Clique para editar o valor"
                                >
                                  <Edit2 className="w-3 h-3 text-muted-foreground hover:text-primary" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {renderStatusBadge(installment, statusInfo, isUpdating)}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
