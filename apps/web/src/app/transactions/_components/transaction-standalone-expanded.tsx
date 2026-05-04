"use client";

import * as React from "react";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { Wallet } from "@/types";
import { TransactionInstallmentsList } from "./transaction-installments-list";
import { TransactionExtraCostsSection } from "./transaction-extra-costs-section";

type DisplayExtraCost = NonNullable<Transaction["extraCosts"]>[number] & {
  parentTransactionId: string;
};

type StatusOption = {
  id: TransactionStatus;
  value: TransactionStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

interface TransactionStandaloneExpandedProps {
  relatedInstallments: Transaction[];
  visibleExtraCosts: DisplayExtraCost[];
  transactionType: Transaction["type"];
  canEdit: boolean;
  canDelete: boolean;
  isUpdating: boolean;
  updatingIds: Set<string>;
  statusOptions: StatusOption[];
  wallets: Wallet[];
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  formatDate: (date: string) => string;
  onStatusChange: (
    transaction: Transaction,
    newStatus: TransactionStatus,
    updateAll?: boolean,
  ) => Promise<boolean>;
  onUpdate?: (
    transaction: Transaction,
    data: Partial<Transaction>,
  ) => Promise<boolean>;
  handlePartialPayment: (tx: Transaction) => void;
  handleUndoPartial: (tx: Transaction) => void;
  handleExtraCostStatusChange: (
    ecId: string,
    parentTxId: string,
    newStatus: TransactionStatus,
  ) => Promise<void>;
  setEditingExtraCost: (
    ec: {
      id: string;
      amount: number;
      description: string;
      wallet?: string;
      parentTransactionId: string;
    } | null,
  ) => void;
  setShowExtraCostDialog: (open: boolean) => void;
  setExtraCostToDelete: (key: string | null) => void;
}

export function TransactionStandaloneExpanded({
  relatedInstallments,
  visibleExtraCosts,
  transactionType,
  canEdit,
  canDelete,
  isUpdating,
  updatingIds,
  statusOptions,
  wallets,
  selectedIds,
  onToggleSelection,
  formatDate,
  onStatusChange,
  onUpdate,
  handlePartialPayment,
  handleUndoPartial,
  handleExtraCostStatusChange,
  setEditingExtraCost,
  setShowExtraCostDialog,
  setExtraCostToDelete,
}: TransactionStandaloneExpandedProps) {
  return (
    <div className="px-4 pb-4 pt-0">
      {relatedInstallments.length > 0 && (
        <TransactionInstallmentsList
          installments={relatedInstallments}
          onStatusChange={onStatusChange}
          onUpdate={onUpdate}
          canEdit={canEdit}
          selectedIds={selectedIds}
          onToggleSelection={onToggleSelection}
          onPartialPayment={handlePartialPayment}
          onUndoPartial={(tx) => Promise.resolve(handleUndoPartial(tx))}
          wallets={wallets}
        />
      )}

      <TransactionExtraCostsSection
        visibleExtraCosts={visibleExtraCosts}
        transactionType={transactionType}
        canEdit={canEdit}
        canDelete={canDelete}
        isUpdating={isUpdating}
        updatingIds={updatingIds}
        statusOptions={statusOptions}
        wallets={wallets}
        selectedIds={selectedIds}
        onToggleSelection={onToggleSelection}
        formatDate={formatDate}
        handleExtraCostStatusChange={handleExtraCostStatusChange}
        setEditingExtraCost={setEditingExtraCost}
        setShowExtraCostDialog={setShowExtraCostDialog}
        setExtraCostToDelete={setExtraCostToDelete}
      />
    </div>
  );
}
