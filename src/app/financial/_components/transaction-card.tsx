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
  DollarSign,
  Share2,
} from "lucide-react";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { typeConfig, statusConfig } from "../_constants/config";
import { formatCurrency } from "@/utils/format";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { toast } from '@/lib/toast';

import { TransactionInstallmentsList } from "./transaction-installments-list";
import { EditBlockDialog } from "./edit-block-dialog";
import { PartialPaymentDialog } from "./partial-payment-dialog";
import { ExtraCostDialog } from "./extra-cost-dialog";
import { TransactionService } from "@/services/transaction-service";
import { SharedTransactionService } from "@/services/shared-transaction-service";
import { useRouter } from "next/navigation";
import { Wallet } from "@/types";

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
  onUpdateExtraCostStatus?: (
    parentTxId: string,
    ecId: string,
    newStatus: TransactionStatus,
  ) => Promise<boolean>;
  onReload?: () => Promise<void>;
  defaultExpanded?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
  onToggleGroupSelection?: (transaction: Transaction) => void;
  selectedIds?: Set<string>;
  // Controlled expansion props
  isExpanded?: boolean;
  onToggleExpand?: (collapsed: boolean) => void;
  wallets?: Wallet[];
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
  onUpdateExtraCostStatus,
  onReload,
  defaultExpanded = false,
  isSelected = false,
  onToggleSelection,
  onToggleGroupSelection,
  selectedIds,
  isExpanded: controlledIsExpanded,
  onToggleExpand,
  wallets = [],
}: TransactionCardProps) {
  const extraCostLabel =
    transaction.type === "income" ? "Acréscimo" : "Custo Extra";
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [updatingIds, setUpdatingIds] = React.useState<Set<string>>(new Set());
  const [extraCostToDelete, setExtraCostToDelete] = React.useState<
    string | null
  >(null);

  // Local state purely for fallback if not controlled
  const [localIsExpanded, setLocalIsExpanded] = React.useState(defaultExpanded);

  // Derived state: Use controlled if provided, else local
  const isExpanded =
    controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;

  const handleToggleExpand = () => {
    const newState = !isExpanded;
    if (onToggleExpand) {
      onToggleExpand(newState);
    } else {
      setLocalIsExpanded(newState);
    }
  };

  const [showEditBlockDialog, setShowEditBlockDialog] = React.useState(false);
  const [isEditingAmount, setIsEditingAmount] = React.useState(false);
  const [editAmountValue, setEditAmountValue] = React.useState<number>(0);
  const [isSavingAmount, setIsSavingAmount] = React.useState(false);

  const [showExtraCostDialog, setShowExtraCostDialog] = React.useState(false);
  const [editingExtraCost, setEditingExtraCost] = React.useState<{
    id?: string;
    amount: number;
    description: string;
    wallet?: string;
  } | null>(null);

  const [showPartialPaymentDialog, setShowPartialPaymentDialog] =
    React.useState(false);
  const [partialPaymentTransaction, setPartialPaymentTransaction] =
    React.useState<Transaction | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = React.useState(false);
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

  const totalExtraCosts = (transaction.extraCosts || []).reduce(
    (sum, ec) => sum + ec.amount,
    0,
  );

  // For proposal groups, show the proposal title instead of individual transaction description
  const displayDescription = isProposalGroup
    ? downPayment?.description.replace("Entrada: ", "") ||
      transaction.description
    : transaction.description;

  // For proposal groups or installment groups, show the total amount
  const displayAmount = React.useMemo(() => {
    if (isProposalGroup) return proposalTotalAmount + totalExtraCosts;
    if (relatedInstallments.length > 0) {
      return (
        relatedInstallments.reduce((sum, t) => sum + t.amount, 0) +
        totalExtraCosts
      );
    }
    return transaction.amount + totalExtraCosts;
  }, [
    isProposalGroup,
    proposalTotalAmount,
    relatedInstallments,
    transaction.amount,
    totalExtraCosts,
  ]);

  // Calculate paid installments count (handling partial payments)
  const installmentStatusCounts = React.useMemo(() => {
    if (isProposalGroup) {
      // For proposal groups, we can just count paid installments directly?
      // Or do they also have splits? Assuming similar logic.
      const installmentsOnly = installments.filter((t) => t.isInstallment);
      const uniqueNumbers = new Set(
        installmentsOnly.map((t) => t.installmentNumber || 0),
      );
      let paidCount = 0;

      uniqueNumbers.forEach((num) => {
        const txs = installmentsOnly.filter(
          (t) => (t.installmentNumber || 0) === num,
        );
        if (txs.length > 0 && txs.every((t) => t.status === "paid")) {
          paidCount++;
        }
      });
      return { paid: paidCount, total: uniqueNumbers.size };
    }

    if (relatedInstallments.length > 0) {
      const installmentsOnly = relatedInstallments.filter(
        (t) => !t.isDownPayment && t.isInstallment,
      );

      const uniqueNumbers = new Set(
        installmentsOnly.map((t) => t.installmentNumber || 0),
      );
      let paidCount = 0;

      uniqueNumbers.forEach((num) => {
        const txs = installmentsOnly.filter(
          (t) => (t.installmentNumber || 0) === num,
        );
        // If all parts of this installment are paid, it counts as paid
        if (txs.length > 0 && txs.every((t) => t.status === "paid")) {
          paidCount++;
        }
      });

      // Use the explicitly separate total count from the first item if available,
      // otherwise use the number of unique installments found.
      const total =
        installmentsOnly.length > 0
          ? installmentsOnly[0].installmentCount || uniqueNumbers.size
          : uniqueNumbers.size;

      return { paid: paidCount, total };
    }

    return null;
  }, [isProposalGroup, installments, relatedInstallments]);

  // Determine which wallet to display
  // Prioritize Installment Wallet over Down Payment Wallet for groups
  const displayWallet = React.useMemo(() => {
    // 1. Proposal Group
    if (isProposalGroup) {
      const firstInstallment = installments.find((t) => t.wallet);
      if (firstInstallment) return firstInstallment.wallet;
    }

    // 2. Installment Group
    if (relatedInstallments.length > 0) {
      const firstInstallment = relatedInstallments.find(
        (t) => !t.isDownPayment && t.wallet,
      );
      if (firstInstallment) return firstInstallment.wallet;
    }

    // 3. Fallback
    // If the main transaction is a down payment part of a group, and we failed to find an installment wallet above,
    // returning the down payment wallet would be misleading as the "main" wallet.
    if (
      transaction.isDownPayment &&
      (isProposalGroup || relatedInstallments.length > 0)
    ) {
      return undefined;
    }

    return transaction.wallet;
  }, [isProposalGroup, installments, relatedInstallments, transaction]);

  // Check how many items are expandable
  const hasExpandableContent =
    isProposalGroup ||
    relatedInstallments.length > 0 ||
    (transaction.extraCosts && transaction.extraCosts.length > 0);

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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingLink(true);
    try {
      const result = await SharedTransactionService.generateShareLink(
        transaction.id,
      );

      try {
        // Try modern clipboard API
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(result.shareUrl);
          toast.success("Link copiado para a área de transferência!");
        } else {
          throw new Error("Clipboard API not available");
        }
      } catch (clipboardError) {
        console.warn("Clipboard API failed, trying fallback", clipboardError);
        // Fallback for older browsers or when focus is lost (execCommand might still work in some browsers)
        try {
          const textArea = document.createElement("textarea");
          textArea.value = result.shareUrl;
          textArea.style.position = "fixed"; // Avoid scrolling to bottom
          textArea.style.left = "-999999px";
          textArea.style.top = "0";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();

          const successful = document.execCommand("copy");
          textArea.remove();

          if (successful) {
            toast.success("Link copiado para a área de transferência!");
          } else {
            throw new Error("Fallback copy failed");
          }
        } catch (fallbackError) {
          console.error("Fallback copy also failed", fallbackError);
          toast.warning(
            "Link gerado, mas não copiado. Por favor, não mude de aba enquanto gera o link.",
            { autoClose: 5000 },
          );
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar link de compartilhamento.");
    } finally {
      setIsGeneratingLink(false);
    }
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
      // BUT, checking `relatedInstallments` is safer.

      const remainder = relatedInstallments.find(
        (t) =>
          !t.isPartialPayment &&
          !t.isDownPayment &&
          t.installmentNumber === partialTx.installmentNumber &&
          t.id !== partialTx.id,
      );

      if (!remainder) {
        toast.error(
          "Não foi possível encontrar a parcela restante para desfazer.",
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
        setIsUpdating(true); // Show some loading state if needed, or just wait
        await onReload();
        setIsUpdating(false);
      } else {
        // Fallback
        router.refresh();
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao desfazer pagamento parcial.");
    }
  };

  const processExtraCost = async (
    extraAmount: number,
    description: string,
    wallet: string,
    editId?: string,
  ) => {
    setIsUpdating(true);
    try {
      let updatedExtraCosts = [...(transaction.extraCosts || [])];

      if (editId) {
        // Edit existing
        updatedExtraCosts = updatedExtraCosts.map((ec) =>
          ec.id === editId
            ? {
                ...ec,
                amount: extraAmount,
                description: description || extraCostLabel,
                wallet: wallet,
              }
            : ec,
        );
      } else {
        // Create new
        const newExtraCost = {
          id: crypto.randomUUID(),
          amount: extraAmount,
          description: description || extraCostLabel,
          status: "pending" as TransactionStatus,
          wallet: wallet,
          createdAt: new Date().toISOString(),
        };
        updatedExtraCosts.push(newExtraCost);
      }

      if (onUpdate) {
        await onUpdate(transaction, { extraCosts: updatedExtraCosts });
      } else {
        await TransactionService.updateTransaction(transaction.id, {
          extraCosts: updatedExtraCosts,
        });
      }

      toast.success(
        editId
          ? `${extraCostLabel} atualizado!`
          : `${extraCostLabel} adicionado com sucesso!`,
      );
      if (onReload) await onReload();
      else router.refresh();
      setEditingExtraCost(null);
    } catch (error) {
      console.error(error);
      toast.error(
        editId
          ? `Erro ao atualizar ${extraCostLabel.toLowerCase()}.`
          : `Erro ao adicionar ${extraCostLabel.toLowerCase()}.`,
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExtraCostStatusChange = async (
    ecId: string,
    newStatus: TransactionStatus,
  ) => {
    setUpdatingIds((prev) => new Set(prev).add(ecId));
    try {
      if (onUpdateExtraCostStatus) {
        await onUpdateExtraCostStatus(transaction.id, ecId, newStatus);
      } else {
        const updatedExtraCosts = (transaction.extraCosts || []).map((ec) =>
          ec.id === ecId ? { ...ec, status: newStatus } : ec,
        );

        if (onUpdate) {
          await onUpdate(transaction, { extraCosts: updatedExtraCosts });
        } else {
          await TransactionService.updateTransaction(transaction.id, {
            extraCosts: updatedExtraCosts,
          });
        }
      }

      toast.success(`Status do ${extraCostLabel.toLowerCase()} atualizado!`);
      if (onReload) await onReload();
      else router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(
        `Erro ao atualizar status do ${extraCostLabel.toLowerCase()}.`,
      );
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(ecId);
        return next;
      });
    }
  };

  const handleDeleteExtraCost = async (ecId: string) => {
    setUpdatingIds((prev) => new Set(prev).add(ecId));
    try {
      const updatedExtraCosts = (transaction.extraCosts || []).filter(
        (ec) => ec.id !== ecId,
      );

      if (onUpdate) {
        await onUpdate(transaction, { extraCosts: updatedExtraCosts });
      } else {
        await TransactionService.updateTransaction(transaction.id, {
          extraCosts: updatedExtraCosts,
        });
      }

      toast.success(`${extraCostLabel} removido com sucesso!`);
      if (onReload) await onReload();
      else router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(`Erro ao remover ${extraCostLabel.toLowerCase()}.`);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(ecId);
        return next;
      });
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
              handleToggleExpand();
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
                {displayWallet && (
                  <>
                    <span>•</span>
                    <span>{displayWallet}</span>
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
                          {installmentStatusCounts ? (
                            <>
                              {installmentStatusCounts.paid}/
                              {installmentStatusCounts.total}x
                            </>
                          ) : (
                            <>{installments.length}x</>
                          )}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {/* Show installment info for standalone installments - UPDATED per user request */}
                {!isProposalGroup && transaction.isInstallment && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      <span className="text-primary font-medium">
                        {installmentStatusCounts ? (
                          <>
                            {installmentStatusCounts.paid}/
                            {installmentStatusCounts.total}x
                          </>
                        ) : (
                          <>
                            {transaction.installmentNumber}/
                            {transaction.installmentCount}x
                          </>
                        )}
                      </span>
                      {/* Mini Progress Bar */}
                      <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full ${typeInfo.color.replace("text-", "bg-")}`}
                          style={{
                            width: installmentStatusCounts
                              ? `${Math.min((installmentStatusCounts.paid / installmentStatusCounts.total) * 100, 100)}%`
                              : `${Math.min(((transaction.installmentNumber || 1) / (transaction.installmentCount || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
                {/* Manual Installment Group Badges */}
                {!isProposalGroup &&
                  relatedInstallments.length > 0 &&
                  !transaction.isInstallment && (
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
                          {installmentStatusCounts ? (
                            <>
                              {installmentStatusCounts.paid}/
                              {installmentStatusCounts.total}x
                            </>
                          ) : (
                            <>
                              {
                                relatedInstallments.filter(
                                  (t) => !t.isDownPayment,
                                ).length
                              }
                              x
                            </>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                {/* Manual Installment Group Badges - Down Payment ONLY (if main is installment) */}
                {!isProposalGroup &&
                  relatedInstallments.length > 0 &&
                  transaction.isInstallment &&
                  relatedInstallments.some((t) => t.isDownPayment) && (
                    <>
                      <span>•</span>
                      <span className="text-blue-500 font-medium flex items-center gap-1">
                        <Banknote className="w-3 h-3" />
                        Entrada
                      </span>
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
              {!isProposalGroup &&
                (relatedInstallments.length > 0 ||
                  (transaction.extraCosts &&
                    transaction.extraCosts.length > 0)) && (
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={handleShare}
                disabled={isGeneratingLink}
                title="Compartilhar Link"
              >
                {isGeneratingLink ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
              </Button>
              {canEdit && !transaction.proposalId && onUpdate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                  onClick={() => setShowExtraCostDialog(true)}
                  title={`Adicionar ${extraCostLabel}`}
                >
                  <DollarSign className="w-4 h-4" />
                </Button>
              )}
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

              {/* Extra Costs Section */}
              {transaction.extraCosts && transaction.extraCosts.length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="flex items-center gap-2 px-1">
                    <DollarSign className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-amber-500/80">
                      {transaction.type === "income"
                        ? "Acréscimos Extras"
                        : "Custos Extras"}{" "}
                      ({transaction.extraCosts.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {transaction.extraCosts.map((ec) => (
                      <div
                        key={ec.id}
                        className={`flex items-center justify-between py-2 px-3 bg-amber-500/5 rounded-lg border border-amber-500/20`}
                      >
                        <div className="flex items-center gap-3">
                          {onToggleSelection && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mr-1"
                            >
                              <Checkbox
                                checked={selectedIds?.has(ec.id) || false}
                                onCheckedChange={() => onToggleSelection(ec.id)}
                                className="cursor-pointer"
                              />
                            </div>
                          )}
                          <div className="p-1.5 rounded-full bg-amber-500/20">
                            <DollarSign className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <div className="font-medium text-sm text-amber-600 dark:text-amber-500">
                              {ec.description}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <span>
                                Adicionado em: {formatDate(ec.createdAt)}
                              </span>
                              {ec.wallet && (
                                <>
                                  <span className="opacity-50">•</span>
                                  <span>
                                    {wallets.find((w) => w.id === ec.wallet)
                                      ?.name || ec.wallet}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-amber-600 dark:text-amber-500">
                            {formatCurrency(ec.amount)}
                          </div>

                          {/* Status Dropdown */}
                          {canEdit ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1.5 rounded-md text-xs font-medium border border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={
                                    isUpdating || updatingIds.has(ec.id)
                                  }
                                >
                                  {updatingIds.has(ec.id) ? (
                                    <>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      <span>Atualizando...</span>
                                    </>
                                  ) : (
                                    <>
                                      {(() => {
                                        const option = statusOptions.find(
                                          (o) =>
                                            o.value ===
                                            (ec.status || "pending"),
                                        );
                                        const Icon = option?.icon || Check;
                                        return <Icon className="h-3 w-3" />;
                                      })()}
                                      <span>
                                        {
                                          statusConfig[ec.status || "pending"]
                                            .label
                                        }
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
                                      handleExtraCostStatusChange(
                                        ec.id,
                                        option.value,
                                      )
                                    }
                                    className="gap-2 cursor-pointer text-xs"
                                  >
                                    <option.icon className="h-3.5 w-3.5" />
                                    <span>{option.label}</span>
                                    {(ec.status || "pending") ===
                                      option.value && (
                                      <Check className="h-3 w-3 ml-auto opacity-50" />
                                    )}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-500"
                            >
                              {statusConfig[ec.status || "pending"].label}
                            </Badge>
                          )}

                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-600 hover:bg-amber-500/10 ml-1"
                                onClick={() => {
                                  setEditingExtraCost({
                                    id: ec.id,
                                    amount: ec.amount,
                                    description: ec.description,
                                    wallet: ec.wallet,
                                  });
                                  setShowExtraCostDialog(true);
                                }}
                                disabled={isUpdating || updatingIds.has(ec.id)}
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                  onClick={() => setExtraCostToDelete(ec.id)}
                                  disabled={
                                    isUpdating || updatingIds.has(ec.id)
                                  }
                                >
                                  {updatingIds.has(ec.id) ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expanded section for standalone installment groups and standalone extra costs */}
          {isExpanded &&
            !isProposalGroup &&
            (relatedInstallments.length > 0 ||
              (transaction.extraCosts &&
                transaction.extraCosts.length > 0)) && (
              <div className="px-4 pb-4 pt-0">
                {relatedInstallments.length > 0 && (
                  <TransactionInstallmentsList
                    installments={relatedInstallments}
                    onStatusChange={onStatusChange!}
                    onUpdate={onUpdate}
                    canEdit={canEdit}
                    selectedIds={selectedIds}
                    onToggleSelection={onToggleSelection}
                    onPartialPayment={handlePartialPayment}
                    onUndoPartial={handleUndoPartial}
                  />
                )}

                {/* Extra Costs Section (Standalone Groups) */}
                {transaction.extraCosts &&
                  transaction.extraCosts.length > 0 && (
                    <div className="space-y-2 mt-4">
                      <div className="flex items-center gap-2 px-1">
                        <DollarSign className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-amber-500/80">
                          {transaction.type === "income"
                            ? "Acréscimos Extras"
                            : "Custos Extras"}{" "}
                          ({transaction.extraCosts.length})
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {transaction.extraCosts.map((ec) => (
                          <div
                            key={ec.id}
                            className={`flex items-center justify-between py-2 px-3 bg-amber-500/5 rounded-lg border border-amber-500/20`}
                          >
                            <div className="flex items-center gap-3">
                              {onToggleSelection && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="mr-1"
                                >
                                  <Checkbox
                                    checked={selectedIds?.has(ec.id) || false}
                                    onCheckedChange={() =>
                                      onToggleSelection(ec.id)
                                    }
                                    className="cursor-pointer"
                                  />
                                </div>
                              )}
                              <div className="p-1.5 rounded-full bg-amber-500/20">
                                <DollarSign className="w-4 h-4 text-amber-500" />
                              </div>
                              <div>
                                <div className="font-medium text-sm text-amber-600 dark:text-amber-500">
                                  {ec.description}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span>
                                    Adicionado em: {formatDate(ec.createdAt)}
                                  </span>
                                  {ec.wallet && (
                                    <>
                                      <span className="opacity-50">•</span>
                                      <span>
                                        {wallets.find((w) => w.id === ec.wallet)
                                          ?.name || ec.wallet}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="font-bold text-amber-600 dark:text-amber-500">
                                {formatCurrency(ec.amount)}
                              </div>

                              {/* Status Dropdown */}
                              {canEdit ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1.5 rounded-md text-xs font-medium border border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10"
                                      onClick={(e) => e.stopPropagation()}
                                      disabled={
                                        isUpdating || updatingIds.has(ec.id)
                                      }
                                    >
                                      {updatingIds.has(ec.id) ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          <span>Atualizando...</span>
                                        </>
                                      ) : (
                                        <>
                                          {(() => {
                                            const option = statusOptions.find(
                                              (o) =>
                                                o.value ===
                                                (ec.status || "pending"),
                                            );
                                            const Icon = option?.icon || Check;
                                            return <Icon className="h-3 w-3" />;
                                          })()}
                                          <span>
                                            {
                                              statusConfig[
                                                ec.status || "pending"
                                              ].label
                                            }
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
                                          handleExtraCostStatusChange(
                                            ec.id,
                                            option.value,
                                          )
                                        }
                                        className="gap-2 cursor-pointer text-xs"
                                      >
                                        <option.icon className="h-3.5 w-3.5" />
                                        <span>{option.label}</span>
                                        {(ec.status || "pending") ===
                                          option.value && (
                                          <Check className="h-3 w-3 ml-auto opacity-50" />
                                        )}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-500"
                                >
                                  {statusConfig[ec.status || "pending"].label}
                                </Badge>
                              )}

                              {canEdit && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-amber-600 hover:bg-amber-500/10 ml-1"
                                    onClick={() => {
                                      setEditingExtraCost({
                                        id: ec.id,
                                        amount: ec.amount,
                                        description: ec.description,
                                        wallet: ec.wallet,
                                      });
                                      setShowExtraCostDialog(true);
                                    }}
                                    disabled={
                                      isUpdating || updatingIds.has(ec.id)
                                    }
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  {canDelete && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                      onClick={() =>
                                        setExtraCostToDelete(ec.id)
                                      }
                                      disabled={
                                        isUpdating || updatingIds.has(ec.id)
                                      }
                                    >
                                      {updatingIds.has(ec.id) ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

      {showExtraCostDialog && (
        <ExtraCostDialog
          isOpen={showExtraCostDialog}
          onOpenChange={(v) => {
            setShowExtraCostDialog(v);
            if (!v) setEditingExtraCost(null);
          }}
          transaction={transaction}
          initialData={editingExtraCost || undefined}
          onConfirm={processExtraCost}
        />
      )}

      <AlertDialog
        open={!!extraCostToDelete}
        onOpenChange={(open) => !open && setExtraCostToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {extraCostLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este {extraCostLabel.toLowerCase()}
              ? Esta ação não pode ser desfeita e removerá o valor do lançamento
              principal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                isUpdating ||
                (extraCostToDelete ? updatingIds.has(extraCostToDelete) : false)
              }
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={
                isUpdating ||
                (extraCostToDelete ? updatingIds.has(extraCostToDelete) : false)
              }
              onClick={() => {
                if (extraCostToDelete) {
                  handleDeleteExtraCost(extraCostToDelete);
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
