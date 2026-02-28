"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ProposalStatus } from "@/types/proposal";
import { TransactionStatus } from "@/services/transaction-service";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Package,
  CalendarDays,
  Tag,
  Layers,
  Building2,
  FileText,
} from "lucide-react";

// ============================================
// HELPERS
// ============================================

function formatDateShort(val?: string): string | null {
  if (!val) return null;
  try {
    let dateStr = val;
    if (dateStr.length === 10 && dateStr.includes("-")) {
      dateStr += "T12:00:00";
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return null;
  }
}

function isDatePast(val?: string): boolean {
  if (!val) return false;
  try {
    let dateStr = val;
    if (dateStr.length === 10 && dateStr.includes("-")) {
      dateStr += "T12:00:00";
    }
    return new Date(dateStr) < new Date();
  } catch {
    return false;
  }
}

// ============================================
// PROPOSAL KANBAN CARD
// ============================================

interface ProposalKanbanCardProps {
  title: string;
  clientName?: string;
  totalValue?: number;
  createdAt?: string;
  validUntil?: string;
  productCount?: number;
  status?: ProposalStatus;
  isDragging?: boolean;
}

export function ProposalKanbanCard({
  title,
  clientName,
  totalValue,
  createdAt,
  validUntil,
  productCount,
  isDragging,
}: ProposalKanbanCardProps) {
  const isExpired = isDatePast(validUntil);

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div
      className={cn(
        "group relative bg-card rounded-xl border border-border/50 p-3 shadow-sm",
        "hover:shadow-md hover:border-border transition-all duration-200",
        isDragging &&
          "shadow-xl opacity-95 ring-2 ring-primary/30 rotate-1 scale-105",
      )}
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
          {title}
        </p>
        {isExpired && (
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full">
            Vencida
          </span>
        )}
      </div>

      {/* Client */}
      {clientName && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-3 h-3 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {clientName}
          </span>
        </div>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40">
        <div className="flex items-center gap-2">
          {/* Product count */}
          {productCount !== undefined && productCount > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Package className="w-3 h-3" />
              <span>{productCount}</span>
            </div>
          )}
          {/* Created date */}
          {createdAt && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <CalendarDays className="w-3 h-3" />
              <span>{formatDateShort(createdAt)}</span>
            </div>
          )}
        </div>
        {/* Total value */}
        {totalValue !== undefined && totalValue > 0 && (
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {formatCurrency(totalValue)}
          </span>
        )}
      </div>

      {/* Validity */}
      {validUntil && (
        <div
          className={cn(
            "flex items-center gap-1 mt-1.5 text-[10px]",
            isExpired ? "text-red-500" : "text-muted-foreground",
          )}
        >
          <Clock className="w-3 h-3 shrink-0" />
          <span>Válida até {formatDateShort(validUntil)}</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// TRANSACTION KANBAN CARD
// ============================================

interface TransactionKanbanCardProps {
  description?: string;
  amount: number;
  type: "income" | "expense";
  dueDate?: string;
  clientName?: string;
  isPartialPayment?: boolean;
  isInstallment?: boolean;
  installmentNumber?: number;
  installmentCount?: number;
  category?: string;
  paidAt?: string;
  status?: TransactionStatus;
  isDragging?: boolean;
  isDownPayment?: boolean;
  proposalId?: string;
}

export function TransactionKanbanCard({
  description,
  amount,
  type,
  dueDate,
  clientName,
  isPartialPayment,
  isInstallment,
  installmentNumber,
  installmentCount,
  category,
  paidAt,
  status,
  isDragging,
  isDownPayment,
  proposalId,
}: TransactionKanbanCardProps) {
  const isIncome = type === "income";

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const isOverdue =
    status === "overdue" || (status === "pending" && isDatePast(dueDate));

  return (
    <div
      className={cn(
        "group relative bg-card rounded-xl border border-border/50 p-3 shadow-sm",
        "hover:shadow-md hover:border-border transition-all duration-200",
        isDragging &&
          "shadow-xl opacity-95 ring-2 ring-primary/30 rotate-1 scale-105",
      )}
    >
      {/* Amount + type indicator */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isIncome ? (
            <ArrowUpCircle className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <ArrowDownCircle className="w-4 h-4 shrink-0 text-red-500" />
          )}
          <span
            className={cn(
              "text-sm font-bold tabular-nums",
              isIncome
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {formatCurrency(amount)}
          </span>
        </div>

        {/* Status indicator */}
        {status === "paid" && (
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
        )}
        {isOverdue && (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
        )}
      </div>

      {/* Tags row - Moved to top for better visibility */}
      <div className="flex flex-wrap items-center gap-1 mb-2.5">
        {isDownPayment && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
            Entrada
          </span>
        )}
        {isInstallment && !isDownPayment && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <Layers className="w-2.5 h-2.5" />
            {installmentNumber && installmentCount
              ? `${installmentNumber}/${installmentCount}`
              : "Parcela"}
          </span>
        )}
        {isPartialPayment && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
            Parcial
          </span>
        )}
        {proposalId && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
            <FileText className="w-2.5 h-2.5" />
            Proposta
          </span>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-foreground font-medium leading-tight mb-2 line-clamp-2">
          {description}
        </p>
      )}

      {/* Meta info container */}
      <div className="space-y-1.5 mb-1 text-muted-foreground">
        {/* Client */}
        {clientName && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="text-[11px] truncate">{clientName}</span>
          </div>
        )}

        {/* Category */}
        {category && (
          <div className="flex items-center gap-1.5">
            <Tag className="w-3 h-3 shrink-0" />
            <span className="text-[10px] truncate">{category}</span>
          </div>
        )}

        {/* Due date / Paid date */}
        {(dueDate || paidAt) && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 shrink-0" />
            <span
              className={cn(
                "text-[10px]",
                isOverdue ? "text-red-500 font-bold" : "",
              )}
            >
              {status === "paid" && paidAt
                ? `Pago: ${formatDateShort(paidAt)}`
                : dueDate
                  ? `Venc: ${formatDateShort(dueDate)}`
                  : null}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
