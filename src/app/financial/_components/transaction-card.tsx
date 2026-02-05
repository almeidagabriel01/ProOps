"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trash2,
  Edit,
  Eye,
  Check,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Banknote,
  CreditCard,
  FileText,
  Edit2,
  Split,
} from "lucide-react";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { typeConfig, statusConfig } from "../_constants/config";
import { formatCurrency } from "@/utils/format";
import { CurrencyInput } from "@/components/ui/currency-input";
import { toast } from "react-toastify";

import { TransactionInstallmentsList } from "./transaction-installments-list";
import { EditBlockDialog } from "./edit-block-dialog";
import { PartialPaymentDialog } from "./partial-payment-dialog";
import { TransactionService } from "@/services/transaction-service";
import { useRouter } from "next/navigation";

interface TransactionCardProps {
  transaction: Transaction;
  relatedInstallments?: Transaction[];
  proposalGroupTransactions?: Transaction[]; // Down payment + installments from same proposal
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
  onUpdateBatch?: (
    updates: { id: string; data: Partial<Transaction> }[],
  ) => Promise<boolean>;
  onRegisterPartialPayment?: (
    originalTransaction: Transaction,
    amount: number,
    date: string,
  ) => Promise<void>;
  defaultExpanded?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onToggleGroupSelection?: (transaction: Transaction) => void;
  selectedIds?: Set<string>;
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

export function TransactionCard({
  transaction,
  relatedInstallments = [],
  proposalGroupTransactions = [],
  canEdit,
  canDelete,
  onDelete,
  onStatusChange,
  onUpdate,
  onUpdateBatch,
  onRegisterPartialPayment,
  defaultExpanded = false,
  isSelected = false,
  onToggleSelection,
  onToggleGroupSelection,
  selectedIds,
}: TransactionCardProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [updatingIds, setUpdatingIds] = React.useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const [showEditBlockDialog, setShowEditBlockDialog] = React.useState(false);
  const [isEditingAmount, setIsEditingAmount] = React.useState(false);
  const [editAmountValue, setEditAmountValue] = React.useState<number>(0);
  const [isSavingAmount, setIsSavingAmount] = React.useState(false);

  const [showPartialPaymentDialog, setShowPartialPaymentDialog] =
    React.useState(false);
  const [partialPaymentTransaction, setPartialPaymentTransaction] =
    React.useState<Transaction | null>(null);
  const router = useRouter();

  // ... rest of implementation until Edit button

  const typeInfo = typeConfig[transaction.type];
  const statusInfo = statusConfig[transaction.status];
  const TypeIcon = typeInfo.icon;

  // Check if this is a proposal group (has both down payment and installments)
  const isProposalGroup = proposalGroupTransactions.length > 1;
  const downPayment = proposalGroupTransactions.find((t) => t.isDownPayment);
  const installments = proposalGroupTransactions.filter((t) => t.isInstallment);
  const proposalTotalAmount = proposalGroupTransactions.reduce(
    (sum, t) => sum + t.amount,
    0,
  );

  // For proposal groups, show the proposal title instead of individual transaction description
  const displayDescription = isProposalGroup
    ? downPayment?.description.replace("Entrada: ", "") ||
      transaction.description
    : transaction.description;

  // For proposal groups or installment groups, show the total amount
  const displayAmount = React.useMemo(() => {
    if (isProposalGroup) return proposalTotalAmount;
    if (relatedInstallments.length > 0) {
      return relatedInstallments.reduce((sum, t) => sum + t.amount, 0);
    }
    return transaction.amount;
  }, [
    isProposalGroup,
    proposalTotalAmount,
    relatedInstallments,
    transaction.amount,
  ]);

  // Check how many items are expandable
  const hasExpandableContent =
    isProposalGroup || relatedInstallments.length > 0;

  const formatDate = (dateString: string) => {
    if (!dateString) return "";

    // Extract date part if ISO format
    const datePart = dateString.includes("T")
      ? dateString.split("T")[0]
      : dateString;

    // Parse date parts manually to avoid timezone issues
    // When using new Date("2026-01-05"), JS interprets it as UTC midnight,
    // which becomes the previous day in timezones like Brazil (UTC-3)
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

  // Handle status change for the main card (updates all in group)
  const handleStatusChange = async (newStatus: TransactionStatus) => {
    if (!onStatusChange || newStatus === transaction.status) return;
    setIsUpdating(true);
    // Default to updating all for the main card action
    await onStatusChange(transaction, newStatus, true);
    setIsUpdating(false);
  };

  // Handle status change for individual transaction with loading state
  const handleIndividualStatusChange = async (
    tx: Transaction,
    newStatus: TransactionStatus,
  ) => {
    if (!onStatusChange || newStatus === tx.status) return;
    setUpdatingIds((prev) => new Set(prev).add(tx.id));
    await onStatusChange(tx, newStatus, false);
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      next.delete(tx.id);
      return next;
    });
  };

  const handleAmountClick = (e: React.MouseEvent) => {
    // Determine if we can edit this
    const isInstallmentGroup =
      !isProposalGroup && relatedInstallments.length > 0;

    // Proposal group or managed by proposal ID -> No edit
    if (isProposalGroup || transaction.proposalId) return;

    // Must have update handlers
    if (!onUpdate) return;

    // If it's an installment group, we need onUpdateBatch to handle distribution
    if (isInstallmentGroup && !onUpdateBatch) return;

    if (!canEdit) return;

    e.stopPropagation();
    // If it's an installment group, edit amount is the sum
    const initialValue = isInstallmentGroup
      ? relatedInstallments.reduce((sum, t) => sum + t.amount, 0)
      : transaction.amount;

    setEditAmountValue(initialValue);
    setIsEditingAmount(true);
  };

  const handleAmountSave = async () => {
    if (!onUpdate) return;

    const isInstallmentGroup =
      !isProposalGroup && relatedInstallments.length > 0;

    // Check if value changed
    // For installment group, compare with sum
    const currentAmount = isInstallmentGroup
      ? relatedInstallments.reduce((sum, t) => sum + t.amount, 0)
      : transaction.amount;

    if (Math.abs(editAmountValue - currentAmount) < 0.01) {
      setIsEditingAmount(false);
      return;
    }

    if (editAmountValue <= 0) {
      toast.warning("O valor deve ser maior que zero");
      return;
    }

    setIsSavingAmount(true);
    try {
      if (isInstallmentGroup && onUpdateBatch) {
        // Distribute new total across installments
        const newInstallmentAmount =
          editAmountValue / relatedInstallments.length;

        const updates = relatedInstallments.map((inst) => ({
          id: inst.id,
          data: { amount: newInstallmentAmount },
        }));

        await onUpdateBatch(updates);
      } else {
        await onUpdate(transaction, { amount: editAmountValue });
      }
      setIsEditingAmount(false);
    } catch (error) {
      console.error(error);
      // Toast is handled in parent
    } finally {
      setIsSavingAmount(false);
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAmountSave();
    } else if (e.key === "Escape") {
      setIsEditingAmount(false);
      const isInstallmentGroup =
        !isProposalGroup && relatedInstallments.length > 0;
      setEditAmountValue(
        isInstallmentGroup
          ? relatedInstallments.reduce((sum, t) => sum + t.amount, 0)
          : transaction.amount,
      );
    }
  };

  const handlePartialPayment = (tx: Transaction) => {
    setPartialPaymentTransaction(tx);
    setShowPartialPaymentDialog(true);
  };

  const processPartialPayment = async (amount: number, date: string) => {
    if (!partialPaymentTransaction) return;

    try {
      if (onRegisterPartialPayment) {
        await onRegisterPartialPayment(partialPaymentTransaction, amount, date);
      } else {
        // Fallback for when callback is not provided
        const original = partialPaymentTransaction;
        const remainingAmount = original.amount - amount;

        // 1. Update original to be the remaining part (keeping same ID)
        await TransactionService.updateTransaction(original.id, {
          amount: remainingAmount,
        });

        // 2. Create new transaction for the paid part
        await TransactionService.createTransaction({
          ...original,
          amount: amount,
          status: "paid",
          date: date,
          description: original.description, // Keep description
          isPartialPayment: true,
          parentTransactionId: original.id,
          // IDs managed by backend or omitted for new creation:
          // installmentGroupId and proposalGroupId should be kept to link them
        });

        toast.success("Pagamento parcial registrado com sucesso!");

        // Refresh the page/view with a small delay to ensure propagation
        setTimeout(() => {
          router.refresh();
        }, 500);
      }
    } catch (error) {
      console.error(error);
      throw error; // Dialog handles error toast
    }
  };

  return (
    <div className="group">
      <Card
        className={`transition-all duration-200 ${
          isExpanded ? "ring-2 ring-primary/20 shadow-md" : "hover:bg-muted/50"
        }`}
      >
        <CardContent className="p-0">
          <div
            className="flex items-center gap-4 py-4 px-4 cursor-pointer"
            onClick={(e) => {
              // Ignore click if it came from a button or interactable element
              const target = e.target as HTMLElement;
              if (
                target.closest("button") ||
                target.closest("a") ||
                target.closest('[role="checkbox"]') ||
                !hasExpandableContent
              ) {
                return;
              }
              setIsExpanded(!isExpanded);
            }}
          >
            {/* Selection Checkbox - use group selection for the main card */}
            {(onToggleGroupSelection || onToggleSelection) && (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => {
                    if (onToggleGroupSelection) {
                      onToggleGroupSelection(transaction);
                    } else if (onToggleSelection) {
                      onToggleSelection(transaction.id);
                    }
                  }}
                  className="cursor-pointer"
                />
              </div>
            )}

            <div className={`p-2 rounded-full bg-muted ${typeInfo.color}`}>
              <TypeIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
                  {displayDescription}
                </span>
                {isProposalGroup && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <FileText className="w-3 h-3" />
                    Proposta
                  </Badge>
                )}
                {transaction.category && !isProposalGroup && (
                  <Badge variant="outline" className="text-xs">
                    {transaction.category}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>{formatDate(transaction.date)}</span>
                {transaction.wallet && (
                  <>
                    <span>•</span>
                    <span>{transaction.wallet}</span>
                  </>
                )}
                {/* Show proposal group summary */}
                {isProposalGroup && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      {downPayment && (
                        <span className="text-blue-500 font-medium flex items-center gap-1">
                          <Banknote className="w-3 h-3" />
                          Entrada
                        </span>
                      )}
                      {installments.length > 0 && (
                        <span className="text-primary font-medium flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          {installments.length}x
                        </span>
                      )}
                    </div>
                  </>
                )}
                {/* Show installment info for standalone installments */}
                {!isProposalGroup && transaction.isInstallment && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-medium">
                        {transaction.installmentNumber}/
                        {transaction.installmentCount}x
                      </span>
                      {/* Mini Progress Bar */}
                      <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full ${typeInfo.color.replace("text-", "bg-")}`}
                          style={{
                            width: `${Math.min(((transaction.installmentNumber || 1) / (transaction.installmentCount || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
                {/* Manual Installment Group Badges */}
                {!isProposalGroup && relatedInstallments.length > 0 && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      {/* Show Down Payment Badge if present */}
                      {relatedInstallments.some((t) => t.isDownPayment) && (
                        <span className="text-blue-500 font-medium flex items-center gap-1">
                          <Banknote className="w-3 h-3" />
                          Entrada
                        </span>
                      )}

                      {/* Show Installment Count Badge */}
                      <span className="text-primary font-medium flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {
                          relatedInstallments.filter((t) => !t.isDownPayment)
                            .length
                        }
                        x
                      </span>
                    </div>
                  </>
                )}
                {transaction.clientName && (
                  <>
                    <span>•</span>
                    <span>{transaction.clientName}</span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right flex items-center gap-4">
              <div>
                <div className={`font-bold ${typeInfo.color}`}>
                  {isEditingAmount ? (
                    <div
                      className="relative flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <CurrencyInput
                        value={editAmountValue}
                        onChange={(e) =>
                          setEditAmountValue(Number(e.target.value))
                        }
                        onKeyDown={handleAmountKeyDown}
                        // Focus on mount logic would need a ref, but primitive autoFocus often works
                        autoFocus
                        disabled={isSavingAmount}
                        className="h-8 py-1 pr-2 pl-8 w-32 text-right font-bold text-sm bg-background border-primary"
                        onBlur={handleAmountSave}
                      />
                      {isSavingAmount && (
                        <div className="absolute -right-6 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 transition-colors rounded px-2 py-1 -mr-2">
                      <span>{transaction.type === "expense" ? "-" : "+"}</span>
                      <span>{formatCurrency(displayAmount)}</span>
                      {canEdit &&
                        !isProposalGroup &&
                        !transaction.proposalId &&
                        onUpdate && (
                          <button
                            onClick={handleAmountClick}
                            className="p-1 hover:bg-muted rounded-full transition-colors group/edit flex items-center justify-center ml-1 cursor-pointer"
                            title="Clique para editar o valor"
                          >
                            <Edit2 className="w-3 h-3 opacity-50 group-hover/edit:opacity-100" />
                          </button>
                        )}
                    </div>
                  )}
                </div>

                {/* Status Badge with Dropdown */}
                {onStatusChange && canEdit ? (
                  <div className="flex items-center gap-2 mt-1 w-full sm:w-auto justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isUpdating}
                          className="h-8 gap-2 rounded-lg font-medium transition-colors border hover:bg-opacity-80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isUpdating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-xs">Atualizando...</span>
                            </>
                          ) : (
                            <>
                              {(() => {
                                const option = statusOptions.find(
                                  (o) => o.value === transaction.status,
                                );
                                const Icon = option?.icon || Check;
                                return <Icon className="h-3.5 w-3.5" />;
                              })()}
                              <span className="text-xs">
                                {statusInfo.label}
                              </span>
                              <ChevronDown className="h-3 w-3 opacity-50" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[160px]">
                        {isProposalGroup && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                              Marcar Todos
                            </div>
                            {statusOptions.map((option) => (
                              <DropdownMenuItem
                                key={`all-${option.value}`}
                                onClick={() => {
                                  handleStatusChange(option.value);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <option.icon className="h-4 w-4" />
                                <span>{option.label}</span>
                                {transaction.status === option.value && (
                                  <Check className="h-3 w-3 ml-auto opacity-50" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        {!isProposalGroup &&
                          statusOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() => {
                                handleStatusChange(option.value);
                              }}
                              className="gap-2 cursor-pointer"
                            >
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
                              {transaction.status === option.value && (
                                <Check className="h-3 w-3 ml-auto opacity-50" />
                              )}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <Badge variant={statusInfo.variant} className="text-xs mt-1">
                    {statusInfo.label}
                  </Badge>
                )}
              </div>

              {/* Show expand icon for proposal groups */}
              {isProposalGroup && (
                <div
                  className={`transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </div>
              )}

              {/* Show expand icon for standalone installment groups */}
              {!isProposalGroup && relatedInstallments.length > 0 && (
                <div
                  className={`transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>

            <div
              className="flex items-center gap-1 pl-2 border-l ml-2"
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={`/financial/${transaction.id}/view`}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Visualizar"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </Link>
              {canEdit &&
                (transaction.proposalId ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Editar (Gerenciado pela Proposta)"
                    onClick={() => setShowEditBlockDialog(true)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                ) : (
                  <Link href={`/financial/${transaction.id}`}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                ))}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDelete(transaction)}
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          {/* Expanded section for proposal groups */}
          {isExpanded && isProposalGroup && (
            <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
              {/* Down Payment Section */}
              {downPayment && (
                <div
                  className={`flex items-center justify-between py-2 px-3 bg-blue-500/10 rounded-lg border border-blue-500/20 ${selectedIds?.has(downPayment.id) ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    {onToggleSelection && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds?.has(downPayment.id) || false}
                          onCheckedChange={() =>
                            onToggleSelection(downPayment.id)
                          }
                          className="cursor-pointer"
                        />
                      </div>
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
                    {onStatusChange && canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5 rounded-md text-xs font-medium border"
                            onClick={(e) => e.stopPropagation()}
                            disabled={updatingIds.has(downPayment.id)}
                          >
                            {updatingIds.has(downPayment.id) ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Atualizando...</span>
                              </>
                            ) : (
                              <>
                                {(() => {
                                  const option = statusOptions.find(
                                    (o) => o.value === downPayment.status,
                                  );
                                  const Icon = option?.icon || Check;
                                  return <Icon className="h-3 w-3" />;
                                })()}
                                <span>
                                  {statusConfig[downPayment.status].label}
                                </span>
                                <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[130px]">
                          {statusOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() =>
                                handleIndividualStatusChange(
                                  downPayment,
                                  option.value,
                                )
                              }
                              className="gap-2 cursor-pointer text-xs"
                            >
                              <option.icon className="h-3.5 w-3.5" />
                              <span>{option.label}</span>
                              {downPayment.status === option.value && (
                                <Check className="h-3 w-3 ml-auto opacity-50" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge
                        variant={statusConfig[downPayment.status].variant}
                        className="text-xs"
                      >
                        {statusConfig[downPayment.status].label}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Installments Section */}
              {installments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Parcelas ({installments.length}x de{" "}
                      {formatCurrency(installments[0]?.amount || 0)})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {installments.map((inst) => (
                      <div
                        key={inst.id}
                        className={`flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border ${selectedIds?.has(inst.id) ? "ring-2 ring-primary" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          {onToggleSelection && (
                            <div onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedIds?.has(inst.id) || false}
                                onCheckedChange={() =>
                                  onToggleSelection(inst.id)
                                }
                                className="cursor-pointer"
                              />
                            </div>
                          )}
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">
                              {inst.installmentNumber}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              Parcela {inst.installmentNumber}/
                              {inst.installmentCount}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Venc: {formatDate(inst.dueDate || inst.date)}
                              {inst.wallet && ` • ${inst.wallet}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-primary">
                            {formatCurrency(inst.amount)}
                          </div>
                          {onStatusChange && canEdit ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1.5 rounded-md text-xs font-medium border"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={updatingIds.has(inst.id)}
                                >
                                  {updatingIds.has(inst.id) ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      <span>Atualizando...</span>
                                    </>
                                  ) : (
                                    <>
                                      {(() => {
                                        const option = statusOptions.find(
                                          (o) => o.value === inst.status,
                                        );
                                        const Icon = option?.icon || Check;
                                        return <Icon className="h-3 w-3" />;
                                      })()}
                                      <span>
                                        {statusConfig[inst.status].label}
                                      </span>
                                      <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                    </>
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-[130px]"
                              >
                                {statusOptions.map((option) => (
                                  <DropdownMenuItem
                                    key={option.value}
                                    onClick={() =>
                                      handleIndividualStatusChange(
                                        inst,
                                        option.value,
                                      )
                                    }
                                    className="gap-2 cursor-pointer text-xs"
                                  >
                                    <option.icon className="h-3.5 w-3.5" />
                                    <span>{option.label}</span>
                                    {inst.status === option.value && (
                                      <Check className="h-3 w-3 ml-auto opacity-50" />
                                    )}
                                  </DropdownMenuItem>
                                ))}
                                {inst.status === "pending" && (
                                  <DropdownMenuItem
                                    onClick={() => handlePartialPayment(inst)}
                                    className="gap-2 cursor-pointer text-xs border-t mt-1 pt-2"
                                  >
                                    <Split className="h-3.5 w-3.5" />
                                    <span>Parcial</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Badge
                              variant={statusConfig[inst.status].variant}
                              className="text-xs"
                            >
                              {statusConfig[inst.status].label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expanded section for standalone installment groups */}
          {isExpanded && !isProposalGroup && relatedInstallments.length > 0 && (
            <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
              <TransactionInstallmentsList
                installments={relatedInstallments}
                onStatusChange={onStatusChange!}
                onUpdate={onUpdate}
                canEdit={canEdit}
                selectedIds={selectedIds}
                onToggleSelection={onToggleSelection}
                onPartialPayment={handlePartialPayment}
              />
            </div>
          )}
        </CardContent>
      </Card>
      <EditBlockDialog
        open={showEditBlockDialog}
        onOpenChange={setShowEditBlockDialog}
      />
      {partialPaymentTransaction && (
        <PartialPaymentDialog
          open={showPartialPaymentDialog}
          onOpenChange={setShowPartialPaymentDialog}
          transaction={partialPaymentTransaction}
          onConfirm={processPartialPayment}
        />
      )}
    </div>
  );
}
