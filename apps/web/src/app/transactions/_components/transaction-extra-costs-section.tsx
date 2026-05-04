"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Trash2, Edit, Check, ChevronDown, DollarSign } from "lucide-react";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { statusConfig } from "../_constants/config";
import { formatCurrency } from "@/utils/format";
import { Wallet } from "@/types";
import { Loader } from "@/components/ui/loader";

type DisplayExtraCost = NonNullable<Transaction["extraCosts"]>[number] & {
  parentTransactionId: string;
};

type StatusOption = {
  id: TransactionStatus;
  value: TransactionStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

interface TransactionExtraCostsSectionProps {
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
  onStatusChange?: (
    transaction: Transaction,
    newStatus: TransactionStatus,
    updateAll?: boolean,
  ) => Promise<boolean>;
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

export function TransactionExtraCostsSection({
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
  handleExtraCostStatusChange,
  setEditingExtraCost,
  setShowExtraCostDialog,
  setExtraCostToDelete,
}: TransactionExtraCostsSectionProps) {
  if (visibleExtraCosts.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <div className="flex items-center gap-2 px-1">
        <DollarSign className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-500/80">
          {transactionType === "income" ? "Acréscimos Extras" : "Custos Extras"}{" "}
          ({visibleExtraCosts.length})
        </span>
      </div>
      <div className="space-y-1.5">
        {visibleExtraCosts.map((ec) => (
          <div
            key={`${ec.parentTransactionId}-${ec.id}`}
            className="flex items-center justify-between py-2 px-3 bg-amber-500/5 rounded-lg border border-amber-500/20"
          >
            <div className="flex items-center gap-3">
              {onToggleSelection && (
                <div onClick={(e) => e.stopPropagation()} className="mr-1">
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
                  <span>Adicionado em: {formatDate(ec.createdAt)}</span>
                  {ec.wallet && (
                    <>
                      <span className="opacity-50">•</span>
                      <span>
                        {wallets.find(
                          (w) => w.id === ec.wallet || w.name === ec.wallet,
                        )?.name || ec.wallet}
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

              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 rounded-md text-xs font-medium border border-amber-500/30 text-amber-600 dark:text-amber-500 hover:bg-amber-500/10"
                      onClick={(e) => e.stopPropagation()}
                      disabled={isUpdating || updatingIds.has(ec.id)}
                    >
                      {updatingIds.has(ec.id) ? (
                        <>
                          <Loader size="sm" />
                          <span>Atualizando...</span>
                        </>
                      ) : (
                        <>
                          {(() => {
                            const option = statusOptions.find(
                              (o) => o.value === (ec.status || "pending"),
                            );
                            const Icon = option?.icon || Check;
                            return <Icon className="h-3 w-3" />;
                          })()}
                          <span>
                            {statusConfig[ec.status || "pending"].label}
                          </span>
                          <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[130px]">
                    {statusOptions.map((option) => (
                      <DropdownMenuItem
                        key={option.id}
                        onClick={() =>
                          handleExtraCostStatusChange(
                            ec.id,
                            ec.parentTransactionId,
                            option.id,
                          )
                        }
                        className="gap-2 cursor-pointer text-xs"
                      >
                        <option.icon className="h-3.5 w-3.5" />
                        <span>{option.label}</span>
                        {(ec.status || "pending") === option.id && (
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
                        parentTransactionId: ec.parentTransactionId,
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
                      onClick={() =>
                        setExtraCostToDelete(
                          `${ec.parentTransactionId}::${ec.id}`,
                        )
                      }
                      disabled={isUpdating || updatingIds.has(ec.id)}
                    >
                      {updatingIds.has(ec.id) ? (
                        <Loader size="sm" />
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
  );
}
