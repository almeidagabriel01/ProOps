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
  ChevronRight,
  Wallet,
  Split,
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
  onPartialPayment?: (transaction: Transaction) => void;
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
  onPartialPayment,
}: TransactionInstallmentsListProps) {
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState<number>(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<number>>(
    new Set(),
  );

  const toggleGroup = (installmentNumber: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(installmentNumber)) {
      newExpanded.delete(installmentNumber);
    } else {
      newExpanded.add(installmentNumber);
    }
    setExpandedGroups(newExpanded);
  };

  // Sort installments by number just in case (kept for backward compatibility with existing logic)
  const sortedInstallments = React.useMemo(() => {
    return [...installments].sort(
      (a, b) => (a.installmentNumber || 0) - (b.installmentNumber || 0),
    );
  }, [installments]);

  // Group installments by number
  const groupedInstallments = React.useMemo(() => {
    const groups = new Map<
      number,
      { main: Transaction; subs: Transaction[] }
    >();

    // Determine if we have actual installments (not just down payment or leftovers)
    // This helps in hiding the "Restante" (non-installment remainder) if true installments exist.
    const hasTrueInstallments = installments.some(
      (i) => i.isInstallment && !i.isDownPayment,
    );

    // Filter out the "Restante" item if we have actual installments.
    // The "Restante" item is characterized by !isInstallment, !isDownPayment, !isPartialPayment (usually).
    // But we need to be careful not to hide legitimate items.
    // Logic: If hasTrueInstallments is true, ignore items that are !isInstallment AND !isDownPayment AND !isPartialPayment.

    const filteredInstallments = installments.filter((item) => {
      // 1. Always exclude Down Payments from this list (they appear in the top section)
      if (item.isDownPayment) return false;

      // 2. If we have actual installments, we want to hide the "Restante" row (which is usually the parent transaction or a non-installment remnant).
      if (hasTrueInstallments) {
        // Keep actual installments
        if (item.isInstallment) return true;

        // Keep partial payments related to installments
        if (item.isPartialPayment && (item.installmentNumber || 0) > 0)
          return true;

        // Hide the "Restante" row
        return false;
      }

      // 3. If no installments exist (e.g. Entry + Remainder), show the Restante row.
      return true;
    });

    // Sort all by date desc first to have latest payments
    const sorted = [...filteredInstallments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    sorted.forEach((item) => {
      const num = item.installmentNumber || 0;
      if (!groups.has(num)) {
        groups.set(num, { main: item, subs: [] });
        return; // Item is placed as main, stop processing
      }

      const group = groups.get(num)!;

      // If this item is a partial payment (has parent or marked isPartial), it goes to subs
      // OR if we already have a main that looks like the parent.
      // Better logic: The "Main" is the one that is NOT a partial payment (original remaining).
      // Partial payments have isPartialPayment: true.

      if (item.isPartialPayment) {
        group.subs.push(item);
      } else {
        // If we already have a main, and this one is also not partial, it might be a data issue or duplicate
        // But let's assume the first non-partial we find is main, or replace if better candidate?
        // Actually, if we encounter a non-partial, it should be the main.
        // If the group was initialized with a partial (because we processed a sub first), we swap.

        if (group.main.isPartialPayment) {
          // Move current main to subs
          group.subs.push(group.main);
          // Set this as main
          group.main = item;
        } else {
          // We have a main already, and this is also not partial?
          // Maybe multiple installments with same number?
          // Just keep the first one found as main, others as subs or treat as separate if needed.
          // For now, if we found another "main-like", we just add to subs to be safe not to hide it.
          if (group.main.id !== item.id) {
            group.subs.push(item);
          }
        }
      }
    });

    // Convert map to array and sort by installment number
    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, group]) => {
        // Sort subs by date desc
        group.subs.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
        return group;
      });
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
            {onPartialPayment && transaction.status === "pending" && (
              <DropdownMenuItem
                onClick={() => onPartialPayment(transaction)}
                className="gap-2 cursor-pointer text-xs border-t mt-1 pt-2"
              >
                <Split className="h-3.5 w-3.5" />
                <span>Parcial</span>
              </DropdownMenuItem>
            )}
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
                Parcelas ({groupedInstallments.length}x)
              </span>
            </div>

            <div className="space-y-2">
              <div className="space-y-2">
                {groupedInstallments.map((group) => {
                  const hasSubs = group.subs.length > 0;
                  const isExpanded = expandedGroups.has(
                    group.main.installmentNumber || 0,
                  );

                  // Main item is always shown. Subs are shown if expanded.
                  const itemsToShow = [group.main];
                  if (isExpanded) {
                    itemsToShow.push(...group.subs);
                  }

                  return (
                    <div
                      key={`group-${group.main.installmentNumber}`}
                      className={cn(
                        "space-y-1 transition-all duration-200",
                        hasSubs &&
                          isExpanded &&
                          "bg-muted/30 p-2 rounded-lg border border-dashed",
                      )}
                    >
                      {/* If it has subs, we might want to render the main item slightly differently or just add the toggle button */}

                      {/* Actually, let's render Main then Subs in a collapse container */}
                      <div
                        key={group.main.id}
                        onClick={() =>
                          hasSubs &&
                          toggleGroup(group.main.installmentNumber || 0)
                        }
                        className={cn(
                          "group/row flex items-center justify-between py-2 px-3 rounded-lg border transition-all bg-muted/50",
                          selectedIds?.has(group.main.id)
                            ? "ring-2 ring-primary"
                            : "",
                          hasSubs && "cursor-pointer hover:bg-muted/70",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {onToggleSelection && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={
                                  selectedIds?.has(group.main.id) || false
                                }
                                onCheckedChange={() =>
                                  onToggleSelection(group.main.id)
                                }
                                className="cursor-pointer"
                              />
                            </div>
                          )}

                          {/* Expand Toggle */}
                          {hasSubs ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGroup(group.main.installmentNumber || 0);
                              }}
                              className="p-0.5 hover:bg-muted-foreground/10 rounded cursor-pointer"
                            >
                              <ChevronRight
                                className={cn(
                                  "w-4 h-4 transition-transform text-muted-foreground",
                                  isExpanded && "rotate-90",
                                )}
                              />
                            </button>
                          ) : // Placeholder for alignment if we want consistent indentation (optional, maybe not needed if mostly singular)
                          // But if user wants perfect alignment, maybe a spacer matching toggle button width (approx 20px)
                          hasSubs ? (
                            <div className="w-5" />
                          ) : null}

                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            {!group.main.isInstallment ? (
                              <Wallet className="w-3.5 h-3.5 text-primary" />
                            ) : (
                              <span className="text-xs font-bold text-primary">
                                {group.main.installmentNumber}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {!group.main.isInstallment
                                ? "Restante"
                                : `Parcela ${group.main.installmentNumber}/${group.main.installmentCount}`}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Venc:{" "}
                              {formatDate(
                                group.main.dueDate || group.main.date,
                              )}
                              {group.main.wallet && ` • ${group.main.wallet}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="font-bold text-primary text-right">
                            {editingId === group.main.id ? (
                              <div className="relative">
                                <div onClick={(e) => e.stopPropagation()}>
                                  <CurrencyInput
                                    value={editValue}
                                    onChange={(e) =>
                                      setEditValue(Number(e.target.value))
                                    }
                                    onKeyDown={(e) =>
                                      handleKeyDown(e, group.main)
                                    }
                                    autoFocus
                                    disabled={isSaving}
                                    className="h-7 py-0.5 pr-2 pl-2 w-28 text-right font-medium text-sm bg-background border-primary"
                                    onBlur={() => handleEditSave(group.main)}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <span>{formatCurrency(group.main.amount)}</span>
                                {canEdit && onUpdate && (
                                  <button
                                    onClick={(e) =>
                                      handleEditClick(group.main, e)
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
                          <div onClick={(e) => e.stopPropagation()}>
                            {renderStatusBadge(
                              group.main,
                              statusConfig[group.main.status],
                              updatingId === group.main.id,
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sub items (render only if expanded) */}
                      {hasSubs && isExpanded && (
                        <div className="space-y-1 pl-10 relative">
                          {/* Vertical connection line */}
                          <div className="absolute left-[34px] top-0 bottom-4 w-px bg-border border-l border-dashed" />

                          {group.subs.map((subItem) => {
                            return (
                              <div
                                key={subItem.id}
                                className="relative flex items-center justify-between py-2 px-3 rounded-lg border bg-muted/30 ml-2"
                              >
                                {/* Horizontal connection line */}
                                <div className="absolute -left-3 top-1/2 w-3 h-px bg-border border-t border-dashed" />

                                <div className="flex items-center gap-3">
                                  {/* No check box for subs usually, or maybe they are implicitly selected? Keeping simple for now */}

                                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                                    <Split className="w-3 h-3" />
                                  </div>

                                  <div>
                                    <div className="font-medium text-sm flex items-center gap-2">
                                      <span>
                                        Parcela {subItem.installmentNumber}/
                                        {subItem.installmentCount}
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className="h-5 px-1 text-[10px]"
                                      >
                                        Parcial
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Pago em: {formatDate(subItem.date)}
                                      {subItem.wallet && ` • ${subItem.wallet}`}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="font-bold text-muted-foreground text-right">
                                    {formatCurrency(subItem.amount)}
                                  </div>
                                  {/* Status for subs is usually Paid */}
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
                                  >
                                    Pago
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
