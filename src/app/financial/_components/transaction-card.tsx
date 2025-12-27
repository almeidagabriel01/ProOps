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
    newStatus: TransactionStatus
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
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleStatusChange = async (newStatus: TransactionStatus) => {
    if (!onStatusChange || newStatus === transaction.status) return;
    setIsUpdating(true);
    await onStatusChange(transaction, newStatus);
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
                        {transaction.installmentNumber}/{transaction.installmentCount}
                        x
                      </span>
                      {/* Mini Progress Bar */}
                      <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden hidden sm:block">
                        <div
                          className={`h-full ${typeInfo.color.replace('text-', 'bg-')}`}
                          style={{
                            width: `${Math.min(((transaction.installmentNumber || 1) / (transaction.installmentCount || 1)) * 100, 100)}%`
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="focus:outline-none cursor-pointer mt-1"
                        disabled={isUpdating}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Badge
                          variant={statusInfo.variant}
                          className="text-xs cursor-pointer hover:brightness-110 transition-all gap-1 pr-1.5"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : null}
                          {statusInfo.label}
                          <ChevronDown className="w-3 h-3 opacity-60" />
                        </Badge>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      {statusOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = transaction.status === option.value;
                        return (
                          <DropdownMenuItem
                            key={option.value}
                            onClick={() => handleStatusChange(option.value)}
                            className={isActive ? "bg-muted" : ""}
                          >
                            <Icon className="w-4 h-4 mr-2" />
                            {option.label}
                            {isActive && <Check className="w-4 h-4 ml-auto" />}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
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

            <div className="flex items-center gap-1 pl-2 border-l ml-2" onClick={(e) => e.stopPropagation()}>
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
