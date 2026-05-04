"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit, Check, ChevronDown, Banknote, CreditCard } from "lucide-react";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { statusConfig } from "../_constants/config";
import { formatCurrency } from "@/utils/format";
import { Wallet } from "@/types";
import { Loader } from "@/components/ui/loader";
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

interface TransactionProposalGroupExpandedProps {
  downPayment: Transaction | null | undefined;
  installments: Transaction[];
  saldoTx: Transaction | null | undefined;
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
  handleIndividualStatusChange: (
    tx: Transaction,
    newStatus: TransactionStatus,
  ) => Promise<void>;
  setShowEditBlockDialog: (open: boolean) => void;
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

export function TransactionProposalGroupExpanded({
  downPayment,
  installments,
  saldoTx,
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
  handleIndividualStatusChange,
  setShowEditBlockDialog,
  handleExtraCostStatusChange,
  setEditingExtraCost,
  setShowExtraCostDialog,
  setExtraCostToDelete,
}: TransactionProposalGroupExpandedProps) {
  return (
    <div className="border-t px-4 py-3 bg-muted/30 space-y-3">
      {/* Down Payment Section */}
      {downPayment && (
        <div
          data-testid="down-payment-row"
          className={`flex items-center justify-between py-2 px-3 bg-blue-500/10 rounded-lg border border-blue-500/20 ${selectedIds?.has(downPayment.id) ? "ring-2 ring-primary" : ""}`}
        >
          <div className="flex items-center gap-3">
            {onToggleSelection && (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds?.has(downPayment.id) || false}
                  onCheckedChange={() => onToggleSelection(downPayment.id)}
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
                Venc: {formatDate(downPayment.dueDate || downPayment.date)}
                {downPayment.wallet &&
                  ` • ${wallets.find((w) => w.id === downPayment.wallet || w.name === downPayment.wallet)?.name ?? downPayment.wallet}`}
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
                        <Loader size="sm" />
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
                        <span>{statusConfig[downPayment.status].label}</span>
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
                        handleIndividualStatusChange(downPayment, option.id)
                      }
                      className="gap-2 cursor-pointer text-xs"
                    >
                      <option.icon className="h-3.5 w-3.5" />
                      <span>{option.label}</span>
                      {downPayment.status === option.id && (
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
            {canEdit &&
              (downPayment.proposalId ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary ml-1"
                  title="Editar (Gerenciado pela Proposta)"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditBlockDialog(true);
                  }}
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Link href={`/transactions/${downPayment.id}`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-1"
                    title="Editar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              ))}
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
                        onCheckedChange={() => onToggleSelection(inst.id)}
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
                      Parcela {inst.installmentNumber}/{inst.installmentCount}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Venc: {formatDate(inst.dueDate || inst.date)}
                      {inst.wallet &&
                        ` • ${wallets.find((w) => w.id === inst.wallet || w.name === inst.wallet)?.name ?? inst.wallet}`}
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
                              <Loader size="sm" />
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
                              <span>{statusConfig[inst.status].label}</span>
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
                              handleIndividualStatusChange(inst, option.id)
                            }
                            className="gap-2 cursor-pointer text-xs"
                          >
                            <option.icon className="h-3.5 w-3.5" />
                            <span>{option.label}</span>
                            {inst.status === option.id && (
                              <Check className="h-3 w-3 ml-auto opacity-50" />
                            )}
                          </DropdownMenuItem>
                        ))}
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
                  {canEdit &&
                    (inst.proposalId ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-primary ml-1"
                        title="Editar (Gerenciado pela Proposta)"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEditBlockDialog(true);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Link href={`/transactions/${inst.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 ml-1"
                          title="Editar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saldo Restante Section */}
      {saldoTx && !installments.length && (
        <div
          data-testid="saldo-row"
          className={`flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border ${selectedIds?.has(saldoTx.id) ? "ring-2 ring-primary" : ""}`}
        >
          <div className="flex items-center gap-3">
            {onToggleSelection && (
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds?.has(saldoTx.id) || false}
                  onCheckedChange={() => onToggleSelection(saldoTx.id)}
                  className="cursor-pointer"
                />
              </div>
            )}
            <div className="p-1.5 rounded-full bg-primary/10">
              <CreditCard className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="font-medium text-sm">Saldo restante</div>
              <div className="text-xs text-muted-foreground">
                Venc: {formatDate(saldoTx.dueDate || saldoTx.date)}
                {saldoTx.wallet &&
                  ` • ${wallets.find((w) => w.id === saldoTx.wallet || w.name === saldoTx.wallet)?.name ?? saldoTx.wallet}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="font-bold text-primary">
              {formatCurrency(saldoTx.amount)}
            </div>
            {onStatusChange && canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 rounded-md text-xs font-medium border"
                    onClick={(e) => e.stopPropagation()}
                    disabled={updatingIds.has(saldoTx.id)}
                  >
                    {updatingIds.has(saldoTx.id) ? (
                      <>
                        <Loader size="sm" />
                        <span>Atualizando...</span>
                      </>
                    ) : (
                      <>
                        {(() => {
                          const option = statusOptions.find(
                            (o) => o.value === saldoTx.status,
                          );
                          const Icon = option?.icon || Check;
                          return <Icon className="h-3 w-3" />;
                        })()}
                        <span>{statusConfig[saldoTx.status].label}</span>
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
                        handleIndividualStatusChange(saldoTx, option.id)
                      }
                      className="gap-2 cursor-pointer text-xs"
                    >
                      <option.icon className="h-3.5 w-3.5" />
                      <span>{option.label}</span>
                      {saldoTx.status === option.id && (
                        <Check className="h-3 w-3 ml-auto opacity-50" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Badge
                variant={statusConfig[saldoTx.status].variant}
                className="text-xs"
              >
                {statusConfig[saldoTx.status].label}
              </Badge>
            )}
            {canEdit &&
              (saldoTx.proposalId ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary ml-1"
                  title="Editar (Gerenciado pela Proposta)"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditBlockDialog(true);
                  }}
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Link href={`/transactions/${saldoTx.id}`}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 ml-1"
                    title="Editar"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              ))}
          </div>
        </div>
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
