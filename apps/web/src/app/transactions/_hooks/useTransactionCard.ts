"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import {
  Transaction,
  TransactionStatus,
  TransactionService,
} from "@/services/transaction-service";
import { Wallet } from "@/types";
import { typeConfig, statusConfig } from "../_constants/config";
import {
  getProposalTransactionDisplayName,
  isProposalLinkedTransaction,
} from "../_lib/proposal-transaction";
import { formatDateBR } from "@/utils/date-format";
import { useTransactionStatuses } from "./useTransactionStatuses";

// ─── Types ────────────────────────────────────────────────────────────────────

type EditingExtraCost = {
  id?: string;
  amount: number;
  description: string;
  wallet?: string;
  parentTransactionId?: string;
} | null;

export interface UseTransactionCardArgs {
  transaction: Transaction;
  relatedInstallments: Transaction[];
  proposalGroupTransactions: Transaction[];
  canEdit: boolean;
  wallets: Wallet[];
  onUpdate?: (transaction: Transaction, data: Partial<Transaction>) => Promise<boolean>;
  onUpdateBatch?: (updates: { id: string; data: Partial<Transaction> }[]) => Promise<boolean>;
  onStatusChange?: (transaction: Transaction, newStatus: TransactionStatus, updateAll?: boolean) => Promise<boolean>;
  onRegisterPartialPayment?: (originalTransaction: Transaction, amount: number, date: string) => Promise<void>;
  onUpdateExtraCostStatus?: (parentTxId: string, ecId: string, newStatus: TransactionStatus) => Promise<boolean>;
  onReload?: () => Promise<void>;
  defaultExpanded?: boolean;
  controlledIsExpanded?: boolean;
  onToggleExpand?: (expanded: boolean) => void;
}

type DisplayExtraCost = NonNullable<Transaction["extraCosts"]>[number] & {
  parentTransactionId: string;
};

export interface TransactionCardState {
  // state
  isUpdating: boolean;
  updatingIds: Set<string>;
  extraCostToDelete: string | null;
  setExtraCostToDelete: React.Dispatch<React.SetStateAction<string | null>>;
  localIsExpanded: boolean;
  showEditBlockDialog: boolean;
  setShowEditBlockDialog: React.Dispatch<React.SetStateAction<boolean>>;
  isEditingAmount: boolean;
  setIsEditingAmount: React.Dispatch<React.SetStateAction<boolean>>;
  editAmountValue: number;
  setEditAmountValue: React.Dispatch<React.SetStateAction<number>>;
  isSavingAmount: boolean;
  showExtraCostDialog: boolean;
  setShowExtraCostDialog: React.Dispatch<React.SetStateAction<boolean>>;
  editingExtraCost: EditingExtraCost;
  setEditingExtraCost: React.Dispatch<React.SetStateAction<EditingExtraCost>>;
  showPartialPaymentDialog: boolean;
  setShowPartialPaymentDialog: React.Dispatch<React.SetStateAction<boolean>>;
  partialPaymentTransaction: Transaction | null;
  shareModalOpen: boolean;
  setShareModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // computed
  typeInfo: (typeof typeConfig)[keyof typeof typeConfig];
  TypeIcon: (typeof typeConfig)[keyof typeof typeConfig]["icon"];
  statusInfo: (typeof statusConfig)[keyof typeof statusConfig];
  isProposalLinked: boolean;
  isProposalGroup: boolean;
  downPayment: Transaction | undefined;
  installments: Transaction[];
  saldoTx: Transaction | undefined;
  visibleExtraCosts: DisplayExtraCost[];
  displayDescription: string;
  displayAmount: number;
  installmentStatusCounts: { paid: number; total: number } | null;
  displayWallet: string | undefined;
  hasExpandableContent: boolean;
  isExpanded: boolean;
  extraCostLabel: string;
  extraCostToDeleteParentId: string;
  extraCostToDeleteId: string | null;
  statusOptions: ReturnType<typeof useTransactionStatuses>["statuses"];
  // handlers
  handleToggleExpand: () => void;
  handleShare: (e: React.MouseEvent) => void;
  handleStatusChange: (newStatus: TransactionStatus) => Promise<void>;
  handleIndividualStatusChange: (tx: Transaction, newStatus: TransactionStatus) => Promise<void>;
  handleAmountClick: (e: React.MouseEvent) => void;
  handleAmountSave: () => Promise<void>;
  handleAmountKeyDown: (e: React.KeyboardEvent) => void;
  handlePartialPayment: (tx: Transaction) => void;
  handleUndoPartial: (partialTx: Transaction) => Promise<void>;
  processPartialPayment: (amount: number, date: string) => Promise<void>;
  processExtraCost: (extraAmount: number, description: string, wallet: string, editId?: string) => Promise<void>;
  handleExtraCostStatusChange: (ecId: string, parentTxId: string, newStatus: TransactionStatus) => Promise<void>;
  handleDeleteExtraCost: (ecId: string, parentTxId: string) => Promise<void>;
  formatDate: (dateString: string) => string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTransactionCard({
  transaction,
  relatedInstallments,
  proposalGroupTransactions,
  canEdit,
  wallets,
  onUpdate,
  onUpdateBatch,
  onStatusChange,
  onRegisterPartialPayment,
  onUpdateExtraCostStatus,
  onReload,
  defaultExpanded = false,
  controlledIsExpanded,
  onToggleExpand,
}: UseTransactionCardArgs): TransactionCardState {
  const { statuses: statusOptions } = useTransactionStatuses();
  const router = useRouter();
  const extraCostLabel = transaction.type === "income" ? "Acréscimo" : "Custo Extra";

  // ─── State ──────────────────────────────────────────────────────────────────

  const [isUpdating, setIsUpdating] = React.useState(false);
  const [updatingIds, setUpdatingIds] = React.useState<Set<string>>(new Set());
  const [extraCostToDelete, setExtraCostToDelete] = React.useState<string | null>(null);
  const [localIsExpanded, setLocalIsExpanded] = React.useState(defaultExpanded);
  const [showEditBlockDialog, setShowEditBlockDialog] = React.useState(false);
  const [isEditingAmount, setIsEditingAmount] = React.useState(false);
  const [editAmountValue, setEditAmountValue] = React.useState<number>(0);
  const [isSavingAmount, setIsSavingAmount] = React.useState(false);
  const [showExtraCostDialog, setShowExtraCostDialog] = React.useState(false);
  const [editingExtraCost, setEditingExtraCost] = React.useState<EditingExtraCost>(null);
  const [showPartialPaymentDialog, setShowPartialPaymentDialog] = React.useState(false);
  const [partialPaymentTransaction, setPartialPaymentTransaction] = React.useState<Transaction | null>(null);
  const [shareModalOpen, setShareModalOpen] = React.useState(false);

  // ─── Derived / non-memo ─────────────────────────────────────────────────────

  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;

  const typeInfo = typeConfig[transaction.type];
  const TypeIcon = typeInfo.icon;
  const statusInfo = statusConfig[transaction.status];
  const isProposalLinked =
    isProposalLinkedTransaction(transaction) ||
    proposalGroupTransactions.some((item) => isProposalLinkedTransaction(item)) ||
    relatedInstallments.some((item) => isProposalLinkedTransaction(item));

  const isProposalGroup = proposalGroupTransactions.length > 1;
  const downPayment = proposalGroupTransactions.find((t) => t.isDownPayment);
  const installments = proposalGroupTransactions.filter((t) => t.isInstallment);
  const saldoTx = proposalGroupTransactions.find((t) => !t.isDownPayment && !t.isInstallment);
  const proposalTotalAmount = proposalGroupTransactions.reduce((sum, t) => sum + t.amount, 0);

  // ─── Memos ──────────────────────────────────────────────────────────────────

  const transactionScope = React.useMemo(() => {
    const scope = new Map<string, Transaction>();
    [transaction, ...proposalGroupTransactions, ...relatedInstallments].forEach((item) => {
      scope.set(item.id, item);
    });
    return Array.from(scope.values());
  }, [transaction, proposalGroupTransactions, relatedInstallments]);

  const visibleExtraCosts = React.useMemo<DisplayExtraCost[]>(() => {
    const extrasById = new Map<string, DisplayExtraCost>();
    const groupTransactions =
      proposalGroupTransactions.length > 0
        ? proposalGroupTransactions
        : relatedInstallments.length > 0
          ? relatedInstallments
          : [transaction];

    groupTransactions.forEach((groupTransaction) => {
      (groupTransaction.extraCosts || []).forEach((extraCost) => {
        extrasById.set(extraCost.id, {
          ...extraCost,
          parentTransactionId: extraCost.parentTransactionId || groupTransaction.id,
        });
      });
    });

    return Array.from(extrasById.values()).sort((a, b) => {
      const aTime = Date.parse(a.createdAt || "");
      const bTime = Date.parse(b.createdAt || "");
      const safeATime = Number.isFinite(aTime) ? aTime : 0;
      const safeBTime = Number.isFinite(bTime) ? bTime : 0;
      return safeBTime - safeATime;
    });
  }, [proposalGroupTransactions, relatedInstallments, transaction]);

  const totalExtraCosts = visibleExtraCosts.reduce((sum, ec) => sum + ec.amount, 0);

  const displayDescription = getProposalTransactionDisplayName(
    isProposalGroup ? downPayment || transaction : transaction,
  );

  const displayAmount = React.useMemo(() => {
    if (isProposalGroup) return proposalTotalAmount + totalExtraCosts;
    if (relatedInstallments.length > 0 && !transaction.isRecurring) {
      return relatedInstallments.reduce((sum, t) => sum + t.amount, 0) + totalExtraCosts;
    }
    return transaction.amount + totalExtraCosts;
  }, [
    isProposalGroup,
    proposalTotalAmount,
    relatedInstallments,
    transaction.isRecurring,
    transaction.amount,
    totalExtraCosts,
  ]);

  const installmentStatusCounts = React.useMemo(() => {
    if (isProposalGroup) {
      const installmentsOnly = installments.filter((t) => t.isInstallment);
      const uniqueNumbers = new Set(installmentsOnly.map((t) => t.installmentNumber || 0));
      let paidCount = 0;
      uniqueNumbers.forEach((num) => {
        const txs = installmentsOnly.filter((t) => (t.installmentNumber || 0) === num);
        if (txs.length > 0 && txs.every((t) => t.status === "paid")) {
          paidCount++;
        }
      });
      return { paid: paidCount, total: uniqueNumbers.size };
    }

    if (relatedInstallments.length > 0) {
      const installmentsOnly = relatedInstallments.filter((t) => !t.isDownPayment && t.isInstallment);
      if (installmentsOnly.length === 0) return null;
      const uniqueNumbers = new Set(installmentsOnly.map((t) => t.installmentNumber || 0));
      let paidCount = 0;
      uniqueNumbers.forEach((num) => {
        const txs = installmentsOnly.filter((t) => (t.installmentNumber || 0) === num);
        if (txs.length > 0 && txs.every((t) => t.status === "paid")) {
          paidCount++;
        }
      });
      return { paid: paidCount, total: uniqueNumbers.size };
    }

    return null;
  }, [isProposalGroup, installments, relatedInstallments]);

  const displayWallet = React.useMemo(() => {
    const resolveWalletName = (v?: string) => {
      if (!v) return undefined;
      return wallets.find((w) => w.id === v || w.name === v)?.name ?? v;
    };

    if (isProposalGroup) {
      const firstInstallment = installments.find((t) => t.wallet);
      if (firstInstallment) return resolveWalletName(firstInstallment.wallet);
    }

    if (relatedInstallments.length > 0) {
      const firstInstallment = relatedInstallments.find((t) => !t.isDownPayment && t.wallet);
      if (firstInstallment) return resolveWalletName(firstInstallment.wallet);
    }

    if (transaction.isDownPayment && (isProposalGroup || relatedInstallments.length > 0)) {
      return undefined;
    }

    return resolveWalletName(transaction.wallet);
  }, [isProposalGroup, installments, relatedInstallments, transaction, wallets]);

  const hasExpandableContent =
    isProposalGroup ||
    visibleExtraCosts.length > 0 ||
    relatedInstallments.some((t) => t.isDownPayment || t.isInstallment || t.isRecurring);

  const [extraCostToDeleteParentId, extraCostToDeleteId] = extraCostToDelete?.includes("::")
    ? extraCostToDelete.split("::")
    : [transaction.id, extraCostToDelete];

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const formatDate = (dateString: string) => formatDateBR(dateString, "");

  const handleToggleExpand = () => {
    const newState = !isExpanded;
    if (onToggleExpand) {
      onToggleExpand(newState);
    } else {
      setLocalIsExpanded(newState);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShareModalOpen(true);
  };

  const handleStatusChange = async (newStatus: TransactionStatus) => {
    if (!onStatusChange || newStatus === transaction.status) return;
    setIsUpdating(true);
    await onStatusChange(transaction, newStatus, true);
    setIsUpdating(false);
  };

  const handleIndividualStatusChange = async (tx: Transaction, newStatus: TransactionStatus) => {
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
    const isInstallmentGroup = !isProposalGroup && relatedInstallments.length > 0;
    if (isProposalGroup || transaction.proposalId) return;
    if (!onUpdate) return;
    if (isInstallmentGroup && !onUpdateBatch) return;
    if (!canEdit) return;
    e.stopPropagation();
    const initialValue = isInstallmentGroup
      ? relatedInstallments.reduce((sum, t) => sum + t.amount, 0)
      : transaction.amount;
    setEditAmountValue(initialValue);
    setIsEditingAmount(true);
  };

  const handleAmountSave = async () => {
    if (!onUpdate) return;
    const isInstallmentGroup = !isProposalGroup && relatedInstallments.length > 0;
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
        const newInstallmentAmount = editAmountValue / relatedInstallments.length;
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
    } finally {
      setIsSavingAmount(false);
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAmountSave();
    } else if (e.key === "Escape") {
      setIsEditingAmount(false);
      const isInstallmentGroup = !isProposalGroup && relatedInstallments.length > 0;
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
        const original = partialPaymentTransaction;
        const remainingAmount = original.amount - amount;
        await TransactionService.updateTransaction(original.id, {
          amount: amount,
          status: "paid",
          date: date,
          isPartialPayment: true,
        });
        const createResult = await TransactionService.createTransaction({
          ...original,
          amount: remainingAmount,
          status: original.status === "paid" ? "pending" : original.status,
          date: original.date,
          description: original.description,
          isPartialPayment: false,
          parentTransactionId: original.id,
          installmentCount: 1,
          id: undefined,
        } as unknown as Omit<Transaction, "id">);
        if (original.isInstallment && (original.installmentCount || 0) > 1 && createResult?.id) {
          await TransactionService.updateTransaction(createResult.id, {
            installmentCount: original.installmentCount,
          });
        }
        toast.success("Pagamento parcial registrado com sucesso!");
        if (onReload) {
          await onReload();
        } else {
          router.refresh();
        }
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleUndoPartial = async (partialTx: Transaction) => {
    try {
      const remainder = relatedInstallments.find(
        (t) =>
          !t.isPartialPayment &&
          !t.isDownPayment &&
          t.installmentNumber === partialTx.installmentNumber &&
          t.id !== partialTx.id,
      );
      if (!remainder) {
        toast.error("Não foi possível encontrar a parcela restante para desfazer.");
        return;
      }
      await TransactionService.deleteTransaction(remainder.id);
      const originalAmount = partialTx.amount + remainder.amount;
      await TransactionService.updateTransaction(partialTx.id, {
        amount: originalAmount,
        status: "pending",
        isPartialPayment: false,
      });
      toast.success("Pagamento parcial desfeito com sucesso!");
      if (onReload) {
        setIsUpdating(true);
        await onReload();
        setIsUpdating(false);
      } else {
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
      const targetParentTxId = editingExtraCost?.parentTransactionId || transaction.id;
      const parentTransaction = transactionScope.find((item) => item.id === targetParentTxId) || transaction;
      let updatedExtraCosts = [...(parentTransaction.extraCosts || [])];
      if (editId) {
        updatedExtraCosts = updatedExtraCosts.map((ec) =>
          ec.id === editId
            ? { ...ec, amount: extraAmount, description: description || extraCostLabel, wallet: wallet }
            : ec,
        );
      } else {
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
        await onUpdate(parentTransaction, { extraCosts: updatedExtraCosts });
      } else {
        await TransactionService.updateTransaction(parentTransaction.id, { extraCosts: updatedExtraCosts });
      }
      toast.success(editId ? `${extraCostLabel} atualizado!` : `${extraCostLabel} adicionado com sucesso!`);
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
    parentTxId: string,
    newStatus: TransactionStatus,
  ) => {
    setUpdatingIds((prev) => new Set(prev).add(ecId));
    try {
      if (onUpdateExtraCostStatus) {
        await onUpdateExtraCostStatus(parentTxId, ecId, newStatus);
      } else {
        const parentTransaction = transactionScope.find((item) => item.id === parentTxId) || transaction;
        const updatedExtraCosts = (parentTransaction.extraCosts || []).map((ec) =>
          ec.id === ecId ? { ...ec, status: newStatus } : ec,
        );
        if (onUpdate) {
          await onUpdate(parentTransaction, { extraCosts: updatedExtraCosts });
        } else {
          await TransactionService.updateTransaction(parentTransaction.id, { extraCosts: updatedExtraCosts });
        }
      }
      toast.success(`Status do ${extraCostLabel.toLowerCase()} atualizado!`);
      if (onReload) await onReload();
      else router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(`Erro ao atualizar status do ${extraCostLabel.toLowerCase()}.`);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(ecId);
        return next;
      });
    }
  };

  const handleDeleteExtraCost = async (ecId: string, parentTxId: string) => {
    setUpdatingIds((prev) => new Set(prev).add(ecId));
    try {
      const parentTransaction = transactionScope.find((item) => item.id === parentTxId) || transaction;
      const updatedExtraCosts = (parentTransaction.extraCosts || []).filter((ec) => ec.id !== ecId);
      if (onUpdate) {
        await onUpdate(parentTransaction, { extraCosts: updatedExtraCosts });
      } else {
        await TransactionService.updateTransaction(parentTransaction.id, { extraCosts: updatedExtraCosts });
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

  // ─── Return ──────────────────────────────────────────────────────────────────

  return {
    // state
    isUpdating,
    updatingIds,
    extraCostToDelete,
    setExtraCostToDelete,
    localIsExpanded,
    showEditBlockDialog,
    setShowEditBlockDialog,
    isEditingAmount,
    setIsEditingAmount,
    editAmountValue,
    setEditAmountValue,
    isSavingAmount,
    showExtraCostDialog,
    setShowExtraCostDialog,
    editingExtraCost,
    setEditingExtraCost,
    showPartialPaymentDialog,
    setShowPartialPaymentDialog,
    partialPaymentTransaction,
    shareModalOpen,
    setShareModalOpen,
    // computed
    typeInfo,
    TypeIcon,
    statusInfo,
    isProposalLinked,
    isProposalGroup,
    downPayment,
    installments,
    saldoTx,
    visibleExtraCosts,
    displayDescription,
    displayAmount,
    installmentStatusCounts,
    displayWallet,
    hasExpandableContent,
    isExpanded,
    extraCostLabel,
    extraCostToDeleteParentId,
    extraCostToDeleteId,
    statusOptions,
    // handlers
    handleToggleExpand,
    handleShare,
    handleStatusChange,
    handleIndividualStatusChange,
    handleAmountClick,
    handleAmountSave,
    handleAmountKeyDown,
    handlePartialPayment,
    handleUndoPartial,
    processPartialPayment,
    processExtraCost,
    handleExtraCostStatusChange,
    handleDeleteExtraCost,
    formatDate,
  };
}
