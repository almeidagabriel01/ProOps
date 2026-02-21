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
import { Wallet } from "@/types";
import { callApi } from "@/lib/api-client";
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
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
  Split,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { PartialPaymentDialog } from "./partial-payment-dialog";
import { TransactionService } from "@/services/transaction-service";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  onSort?: (key: string) => void;
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
  onRegisterPartialPayment?: (
    originalTransaction: Transaction,
    amount: number,
    date: string,
  ) => Promise<void>;
  onUpdateExtraCostStatus?: (
    parentTxId: string,
    ecId: string,
    newStatus: TransactionStatus,
  ) => Promise<boolean>;

  onReload?: () => Promise<void>;
  wallets?: Wallet[];
  allTransactions?: Transaction[];
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
  onUpdate,
  selectedIds,
  onToggleSelection,
  onToggleSelectAll,
  onSort,
  sortConfig,
  onRegisterPartialPayment,
  onUpdateExtraCostStatus,
  onReload,
  wallets = [],
  allTransactions = [],
}: TransactionListByDueDateProps) {
  const [updatingState, setUpdatingState] = React.useState<{
    id: string;
    field: "status" | "wallet";
  } | null>(null);
  const router = useRouter();

  const [extraCostToDelete, setExtraCostToDelete] = React.useState<{
    ecId: string;
    parentTxId: string;
    label: string;
  } | null>(null);
  const [isDeletingExtraCost, setIsDeletingExtraCost] = React.useState(false);

  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(),
  );

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const [showPartialPaymentDialog, setShowPartialPaymentDialog] =
    React.useState(false);
  const [partialPaymentTransaction, setPartialPaymentTransaction] =
    React.useState<Transaction | null>(null);

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

        // 1. Update original to be the PAID part (Partial)
        await TransactionService.updateTransaction(original.id, {
          amount: amount,
          status: "paid",
          date: date,
          isPartialPayment: true,
        });

        // 2. Create new transaction for the REMAINING part (Pending/Main)
        // Bypass backend recursion for Installment 1
        const createResult = await TransactionService.createTransaction({
          ...original,
          amount: remainingAmount,
          status: original.status === "paid" ? "pending" : original.status,
          date: original.date, // Keep original date for the main/remaining part? Or update? Usually keep original due date etc.
          description: original.description,
          isPartialPayment: false,
          parentTransactionId: original.id,
          installmentCount: 1, // Bypass backend recursion
          id: undefined,
          // IDs managed by backend or omitted for new creation:
          // installmentGroupId and proposalGroupId should be kept to link them
        } as unknown as Omit<Transaction, "id">);

        // 2.1 Restore count
        if (
          original.isInstallment &&
          (original.installmentCount || 0) > 1 &&
          createResult?.id
        ) {
          await TransactionService.updateTransaction(createResult.id, {
            installmentCount: original.installmentCount,
          });
        }

        toast.success("Pagamento parcial registrado com sucesso!");

        // Refresh the page/view with a small delay to ensure propagation
        if (onReload) {
          await onReload();
        } else {
          router.refresh();
        }
      }
    } catch (error) {
      console.error(error);
      throw error; // Dialog handles error toast
    }
  };

  const handleUndoPartial = async (partialTx: Transaction) => {
    try {
      // 1. Find the remainder (pending) transaction
      // It should share the same parentTransactionId or have some link.
      // Usually, partial has isPartialPayment=true. The remainder has isPartialPayment=false (or undefined)
      // and shares the same installmentNumber and installmentGroupId/proposalId if applicable.

      // In the flat list, we have `transactions` prop but it might be just a page or infinite scroll buffer.
      // We need to find it in the provided list or fetch it?
      // For safety, we should try to find it in the current list `transactions` or `displayedItems` first.

      const remainder = transactions.find(
        (t) =>
          !t.isPartialPayment &&
          !t.isDownPayment &&
          t.installmentNumber === partialTx.installmentNumber &&
          t.id !== partialTx.id &&
          // Ideally check installmentGroupId or proposalGroupId too if available
          (partialTx.installmentGroupId
            ? t.installmentGroupId === partialTx.installmentGroupId
            : true) &&
          (partialTx.proposalGroupId
            ? t.proposalGroupId === partialTx.proposalGroupId
            : true),
      );

      if (!remainder) {
        toast.error(
          "Não foi possível encontrar a parcela restante para desfazer nesta visualização.",
        );
        return;
      }

      // 2. Delete the remainder
      await TransactionService.deleteTransaction(remainder.id);

      // 3. Update the partial to be full again
      // Status -> Pending
      // Amount -> Partial + Remainder
      // isPartialPayment -> false
      const originalAmount = partialTx.amount + remainder.amount;
      await TransactionService.updateTransaction(partialTx.id, {
        amount: originalAmount,
        status: "pending",
        isPartialPayment: false,
        // parentTransactionId: null, // Depending on backend, might need to clear this.
        // Sending null might not be supported by type, but undefined skips update.
        // If we can't clear it easily, it's fine, as long as isPartialPayment is false.
      });

      toast.success("Pagamento parcial desfeito com sucesso!");

      if (onReload) {
        setUpdatingState({ id: partialTx.id, field: "status" });
        await onReload();
        setUpdatingState(null);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao desfazer pagamento parcial.");
    }
  };

  // Infinite scroll: 15 rows per batch
  const { displayedItems, hasMore, sentinelRef } = useInfiniteScroll(
    transactions,
    15,
  );

  const groupedTransactions = React.useMemo(() => {
    const groups = new Map<
      string,
      { main: Transaction; subs: Transaction[] }
    >();

    const displayedIds = new Set(displayedItems.map((t) => t.id));

    displayedItems.forEach((transaction) => {
      // Determine a unique key for grouping
      let key = transaction.id;
      let groupId = "";
      let installNum = 0;

      if (transaction.installmentGroupId || transaction.proposalGroupId) {
        groupId =
          transaction.installmentGroupId || transaction.proposalGroupId || "";
        installNum = transaction.installmentNumber || 0;
        key = `${groupId}-${installNum}`;
      }

      if (!groups.has(key)) {
        groups.set(key, { main: transaction, subs: [] });

        // If this is a grouped transaction, try to find hidden siblings in allTransactions
        // Only look for siblings if we have a valid groupId
        if (groupId && allTransactions.length > 0) {
          const group = groups.get(key)!;
          const siblings = allTransactions.filter(
            (t) =>
              t.id !== transaction.id &&
              // Use the same groupId logic for siblings
              (t.installmentGroupId === groupId ||
                t.proposalGroupId === groupId) &&
              t.installmentNumber === installNum &&
              // IMPORTANT: Only add siblings that are NOT currently displayed
              // Displayed siblings will be processed by the main loop
              !displayedIds.has(t.id),
          );

          siblings.forEach((sibling) => {
            // Check if sibling is already in subs (unlikely as we just created group)
            if (!group.subs.some((s) => s.id === sibling.id)) {
              group.subs.push(sibling);
            }
          });
        }
      } else {
        const group = groups.get(key)!;
        // Logic to determine Main vs Sub
        // We want the "Pending" (Remainder) or Non-Partial to be Main
        if (transaction.isPartialPayment) {
          if (!group.subs.some((s) => s.id === transaction.id)) {
            group.subs.push(transaction);
          }
        } else {
          if (group.main.isPartialPayment) {
            // Swap: Current main becomes sub, new one becomes main
            if (!group.subs.some((s) => s.id === group.main.id)) {
              group.subs.push(group.main);
            }
            group.main = transaction;
          } else {
            // Collision of two non-partials? Treat as sub for now
            if (!group.subs.some((s) => s.id === transaction.id)) {
              group.subs.push(transaction);
            }
          }
        }
      }
    });

    // Sort subs by date desc for each group
    groups.forEach((group) => {
      group.subs.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    });

    return Array.from(groups.entries());
  }, [displayedItems, allTransactions]);

  const handleStatusChange = async (
    transaction: Transaction,
    newStatus: TransactionStatus,
  ) => {
    if ((transaction as any).isExtraCostSync) {
      if (transaction.status === newStatus) return;

      const parentTx = allTransactions.find(
        (t) => t.id === transaction.parentTransactionId,
      );
      if (!parentTx) {
        toast.error("Transação de origem não encontrada.");
        return;
      }

      setUpdatingState({ id: transaction.id, field: "status" });
      try {
        if (onUpdateExtraCostStatus) {
          await onUpdateExtraCostStatus(parentTx.id, transaction.id, newStatus);
        } else if (onUpdate) {
          const updatedExtraCosts = (parentTx.extraCosts || []).map((ec) =>
            ec.id === transaction.id ? { ...ec, status: newStatus } : ec,
          );
          await onUpdate(parentTx, { extraCosts: updatedExtraCosts });
        }
      } catch (error) {
        console.error("Error updating extra cost status:", error);
        toast.error("Erro ao atualizar acréscimo/custo extra.");
      } finally {
        setUpdatingState(null);
      }
      return;
    }

    if (!onStatusChange || transaction.status === newStatus) return;
    setUpdatingState({ id: transaction.id, field: "status" });
    try {
      await onStatusChange(transaction, newStatus, false);
    } finally {
      setUpdatingState(null);
    }
  };

  const handleWalletChange = async (
    transaction: Transaction,
    walletId: string,
  ) => {
    if ((transaction as any).isExtraCostSync) {
      setUpdatingState({ id: transaction.id, field: "wallet" });

      const parentTx = allTransactions.find(
        (t) => t.id === transaction.parentTransactionId,
      );
      if (!parentTx) {
        setUpdatingState(null);
        toast.error("Transação de origem não encontrada.");
        return;
      }

      try {
        const updatedExtraCosts = (parentTx.extraCosts || []).map((ec) =>
          ec.id === transaction.id ? { ...ec, wallet: walletId } : ec,
        );
        if (onUpdate) {
          await onUpdate(parentTx, { extraCosts: updatedExtraCosts });
        }
      } catch (error) {
        console.error("Error updating extra cost wallet:", error);
        toast.error("Erro ao atualizar carteira do acréscimo/custo extra.");
      } finally {
        setUpdatingState(null);
      }
      return;
    }

    if (!onUpdate) return;
    setUpdatingState({ id: transaction.id, field: "wallet" });
    try {
      await onUpdate(transaction, { wallet: walletId });
    } finally {
      setUpdatingState(null);
    }
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
    <div className="flex flex-col gap-4 flex-1">
      <Card>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="grid grid-cols-[54px_1fr_100px_100px_100px_100px_80px] gap-4 px-4 py-2 bg-muted/50 border-b text-xs font-medium text-muted-foreground">
            <div className="flex items-center pl-2">
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
            <HeaderCell
              label="Descrição"
              sortKey="description"
              onSort={onSort}
              sortConfig={sortConfig}
            />
            <HeaderCell
              label="Vencimento"
              sortKey="dueDate"
              onSort={onSort}
              sortConfig={sortConfig}
              className="text-center justify-center"
            />
            <HeaderCell
              label="Valor"
              sortKey="amount"
              onSort={onSort}
              sortConfig={sortConfig}
              className="text-center justify-center"
            />
            <HeaderCell
              label="Carteira"
              sortKey="wallet"
              onSort={onSort}
              sortConfig={sortConfig}
              className="text-center justify-center"
            />
            <HeaderCell
              label="Status"
              sortKey="status"
              onSort={onSort}
              sortConfig={sortConfig}
              className="text-center justify-center"
            />
            <div className="text-right">Ações</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y">
            {groupedTransactions.map(([groupKey, group]) => {
              const { main: transaction, subs } = group;
              const hasSubs = subs.length > 0;
              const isExpanded = expandedGroups.has(groupKey);

              // Helper to render a single row (Main or Sub)
              const renderRow = (
                tx: Transaction,
                isSubItem: boolean = false,
              ) => {
                const isUpdatingStatus =
                  updatingState?.id === tx.id &&
                  updatingState?.field === "status";
                const isUpdatingWallet =
                  updatingState?.id === tx.id &&
                  updatingState?.field === "wallet";
                const isRowUpdating = updatingState?.id === tx.id;

                const statusInfo = statusConfig[tx.status];
                const isSelected = selectedIds.has(tx.id);

                return (
                  <div
                    key={tx.id}
                    className={cn(
                      "grid grid-cols-[54px_1fr_100px_100px_100px_100px_80px] gap-4 px-4 py-2.5 items-center hover:bg-muted/50 transition-colors text-sm cursor-pointer", // Added cursor-pointer
                      isSelected
                        ? tx.type === "income"
                          ? "bg-green-500/15"
                          : "bg-red-500/20"
                        : "",
                      isSubItem && "bg-muted/30 pl-12", // Increased indent for sub-items
                    )}
                    onClick={() => {
                      if (!isSubItem && hasSubs) {
                        toggleGroup(groupKey);
                      }
                    }}
                  >
                    {/* Checkbox / Chevron */}
                    <div className="flex items-center gap-2 pl-2">
                      {/* Always show checkbox if not sub-item or if sub-item logic requires it (usually sub-items also selectable? user didn't specify, but "keep checkbox" usually implies for the main item) */}
                      {/* User said: "vquero que mantenha o checkbox mesmo assim, e a setinha informando se esta aberto ou fechado ao lado" */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelection(tx.id)}
                          className="cursor-pointer"
                        />
                      </div>

                      {!isSubItem && hasSubs && (
                        <div className="w-4 flex justify-center">
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="flex items-center gap-2 min-w-0">
                      {tx.type === "income" ? (
                        <ArrowUpCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      ) : (
                        <ArrowDownCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="truncate">{tx.description}</span>
                      {tx.isInstallment && !tx.isDownPayment && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({tx.installmentNumber}/{tx.installmentCount})
                        </span>
                      )}
                      {tx.isDownPayment && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4 px-1 shrink-0"
                        >
                          Entrada
                        </Badge>
                      )}
                      {tx.isPartialPayment && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1 shrink-0 border-blue-200 bg-blue-50 text-blue-700"
                        >
                          Parcial
                        </Badge>
                      )}
                      {(tx as any).isExtraCostSync && (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-4 px-1 shrink-0 border-amber-200 bg-amber-50 text-amber-700 dark:text-amber-500"
                        >
                          {tx.type === "income" ? "Acréscimo" : "Custo Extra"}
                        </Badge>
                      )}
                    </div>

                    {/* Due Date */}
                    <div className="text-center text-xs text-muted-foreground">
                      {formatDate(tx.dueDate || tx.date)}
                    </div>

                    {/* Amount */}
                    <div
                      className={`text-center font-medium ${getTypeColor(tx)}`}
                    >
                      {tx.type === "expense" ? "-" : ""}
                      {formatCurrency(tx.amount)}
                    </div>

                    {/* Wallet */}
                    <div
                      className="flex justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canEdit && onUpdate ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 max-w-[100px] px-2 text-xs border"
                              disabled={isRowUpdating}
                            >
                              {isUpdatingWallet ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <span className="truncate">
                                    {wallets.find((w) => w.name === tx.wallet)
                                      ?.name ||
                                      tx.wallet ||
                                      "Sem carteira"}
                                  </span>
                                  <ChevronDown className="ml-1 h-3 w-3 opacity-50 shrink-0" />
                                </>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[150px]"
                          >
                            {wallets.map((wallet) => (
                              <DropdownMenuItem
                                key={wallet.id}
                                onClick={() =>
                                  handleWalletChange(tx, wallet.name)
                                }
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <span>{wallet.name}</span>
                                {tx.wallet === wallet.name && (
                                  <Check className="h-3 w-3 ml-auto opacity-50" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {tx.wallet || "-"}
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <div
                      className="flex justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {tx.isPartialPayment ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] h-5 px-1 bg-green-50 text-green-700 border-green-200 gap-1"
                        >
                          <Check className="w-3 h-3" />
                          Pago
                        </Badge>
                      ) : canEdit && onStatusChange ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 gap-1 px-2 text-xs border"
                              disabled={isRowUpdating}
                            >
                              {isUpdatingStatus ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  {(() => {
                                    const opt = statusOptions.find(
                                      (o) =>
                                        o.value === (tx.status || "pending"),
                                    );
                                    const Icon = opt?.icon || Check;
                                    return <Icon className="h-3 w-3" />;
                                  })()}
                                  <span>
                                    {
                                      statusConfig[tx.status || "pending"]
                                        ?.label
                                    }
                                  </span>
                                  <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                                </>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-[120px]"
                          >
                            {statusOptions.map((option) => (
                              <DropdownMenuItem
                                key={option.value}
                                onClick={() =>
                                  handleStatusChange(tx, option.value)
                                }
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <option.icon className="h-3 w-3" />
                                <span>{option.label}</span>
                                {tx.status === option.value && (
                                  <Check className="h-3 w-3 ml-auto opacity-50" />
                                )}
                              </DropdownMenuItem>
                            ))}
                            {onRegisterPartialPayment &&
                              tx.status === "pending" && (
                                <DropdownMenuItem
                                  onClick={() => handlePartialPayment(tx)}
                                  className="gap-2 cursor-pointer text-xs border-t mt-1 pt-2"
                                >
                                  <Split className="h-3 w-3" />
                                  <span>Parcial</span>
                                </DropdownMenuItem>
                              )}
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
                      {tx.isPartialPayment && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-blue-600 hover:text-blue-700"
                          onClick={() => handleUndoPartial(tx)}
                          title="Desfazer Parcial"
                        >
                          <Split className="w-3 h-3 rotate-180" />
                        </Button>
                      )}
                      {!(tx as any).isExtraCostSync && (
                        <Link href={`/financial/${tx.id}/view`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Ver"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                      {(tx as any).isExtraCostSync && (
                        <Link
                          href={`/financial/${(tx as any).parentTransactionId}/extra-cost/${tx.id}`}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Ver Acréscimo/Custo Extra"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </Link>
                      )}
                      {canDelete && !(tx as any).isExtraCostSync && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => onDelete(tx)}
                          title="Excluir"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                      {canDelete && (tx as any).isExtraCostSync && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          disabled={isDeletingExtraCost}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExtraCostToDelete({
                              ecId: tx.id,
                              parentTxId: (tx as any).parentTransactionId,
                              label:
                                tx.type === "income"
                                  ? "Acréscimo"
                                  : "Custo Extra",
                            });
                          }}
                          title="Excluir"
                        >
                          {isDeletingExtraCost ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              };

              return (
                <div key={groupKey + transaction.id}>
                  {renderRow(transaction, false)}
                  {hasSubs &&
                    isExpanded &&
                    subs.map((sub) => renderRow(sub, true))}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex items-center justify-center py-4"
        >
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {partialPaymentTransaction && (
        <PartialPaymentDialog
          open={showPartialPaymentDialog}
          onOpenChange={setShowPartialPaymentDialog}
          transaction={partialPaymentTransaction}
          onConfirm={processPartialPayment}
        />
      )}

      <AlertDialog
        open={!!extraCostToDelete}
        onOpenChange={(open) => !open && setExtraCostToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {extraCostToDelete?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este{" "}
              {extraCostToDelete?.label?.toLowerCase()}? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingExtraCost}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingExtraCost}
              onClick={async () => {
                if (!extraCostToDelete) return;
                setIsDeletingExtraCost(true);
                try {
                  const parentTx = allTransactions.find(
                    (t) => t.id === extraCostToDelete.parentTxId,
                  );
                  if (!parentTx) {
                    toast.error("Lançamento de origem não encontrado.");
                    return;
                  }
                  const updatedExtraCosts = (parentTx.extraCosts || []).filter(
                    (ec) => ec.id !== extraCostToDelete.ecId,
                  );
                  if (onUpdate) {
                    await onUpdate(parentTx, { extraCosts: updatedExtraCosts });
                  }
                  toast.success(`${extraCostToDelete.label} removido!`);
                  if (onReload) await onReload();
                } catch (err) {
                  console.error(err);
                  toast.error("Erro ao excluir.");
                } finally {
                  setIsDeletingExtraCost(false);
                  setExtraCostToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HeaderCell({
  label,
  sortKey,
  onSort,
  sortConfig,
  className,
}: {
  label: string;
  sortKey: string;
  onSort?: (key: string) => void;
  sortConfig?: { key: string | null; direction: "asc" | "desc" | null };
  className?: string;
}) {
  const isSorted = sortConfig?.key === sortKey;
  const direction = isSorted ? sortConfig?.direction : null;

  return (
    <div className={cn("flex items-center", className)}>
      <button
        className="flex items-center gap-1 cursor-pointer select-none hover:text-foreground transition-colors focus:outline-none"
        onClick={() => onSort?.(sortKey)}
      >
        {label}
        <span className="text-muted-foreground/50">
          {direction === "asc" ? (
            <ArrowUp className="w-3 h-3 text-foreground" />
          ) : direction === "desc" ? (
            <ArrowDown className="w-3 h-3 text-foreground" />
          ) : (
            <ChevronsUpDown className="w-3 h-3 opacity-50" />
          )}
        </span>
      </button>
    </div>
  );
}
