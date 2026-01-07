"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { typeConfig, statusConfig } from "../_constants/config";
import { formatCurrency } from "@/utils/format";

import { TransactionInstallmentsList } from "./transaction-installments-list";

interface TransactionCardProps {
  transaction: Transaction;
  relatedInstallments?: Transaction[];
  canEdit: boolean;
  canDelete: boolean;
  onDelete: (transaction: Transaction) => void;
  onStatusChange?: (
    transaction: Transaction,
    newStatus: TransactionStatus,
    updateAll?: boolean
  ) => Promise<boolean>;
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
  canEdit,
  canDelete,
  onDelete,
  onStatusChange,
}: TransactionCardProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const typeInfo = typeConfig[transaction.type];
  const statusInfo = statusConfig[transaction.status];
  const TypeIcon = typeInfo.icon;

  const formatDate = (dateString: string) => {
    if (!dateString) return "";

    // Extract date part if ISO format
    const datePart = dateString.includes("T") ? dateString.split("T")[0] : dateString;

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


  const handleStatusChange = async (newStatus: TransactionStatus) => {
    if (!onStatusChange || newStatus === transaction.status) return;
    setIsUpdating(true);
    // Default to updating all for the main card action
    await onStatusChange(transaction, newStatus, true);
    setIsUpdating(false);
  };

  return (
    <div className="group">
      <Card
        className={`transition-all duration-200 ${isExpanded ? "ring-2 ring-primary/20 shadow-md" : "hover:bg-muted/50"
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
                relatedInstallments.length === 0
              ) {
                return;
              }
              setIsExpanded(!isExpanded);
            }}
          >
            <div className={`p-2 rounded-full bg-muted ${typeInfo.color}`}>
              <TypeIcon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
                  {transaction.description}
                </span>
                {transaction.category && (
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
                {transaction.isInstallment && (
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
                  {transaction.type === "expense" ? "-" : "+"}
                  {formatCurrency(transaction.amount)}
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
                                const option = statusOptions.find(o => o.value === transaction.status);
                                const Icon = option?.icon || Check;
                                return <Icon className="h-3.5 w-3.5" />;
                              })()}
                              <span className="text-xs">{statusInfo.label}</span>
                              <ChevronDown className="h-3 w-3 opacity-50" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[140px]">
                        {statusOptions.map((option) => (
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

              {relatedInstallments.length > 0 && (
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
              {canEdit && (
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
              )}
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

          {isExpanded && relatedInstallments.length > 0 && (
            <TransactionInstallmentsList
              installments={relatedInstallments}
              onStatusChange={onStatusChange!}
              canEdit={canEdit}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
