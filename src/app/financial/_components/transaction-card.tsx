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

interface TransactionCardProps {
  transaction: Transaction;
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
  canEdit,
  canDelete,
  onDelete,
  onStatusChange,
}: TransactionCardProps) {
  const [isUpdating, setIsUpdating] = React.useState(false);
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
    <Card className="hover:bg-muted/50 transition-colors">
      <CardContent className="flex items-center gap-4 py-4 px-4">
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
                <span className="text-primary">
                  {transaction.installmentNumber}/{transaction.installmentCount}
                  x
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

        <div className="text-right">
          <div className={`font-bold ${typeInfo.color}`}>
            {transaction.type === "expense" ? "-" : "+"}
            {formatCurrency(transaction.amount)}
          </div>

          {/* Status Badge with Dropdown */}
          {onStatusChange && canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="focus:outline-none cursor-pointer"
                  disabled={isUpdating}
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
            <Badge variant={statusInfo.variant} className="text-xs">
              {statusInfo.label}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
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
      </CardContent>
    </Card>
  );
}
