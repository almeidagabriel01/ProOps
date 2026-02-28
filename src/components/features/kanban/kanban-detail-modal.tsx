"use client";

import * as React from "react";
import { Proposal, ProposalStatus } from "@/types/proposal";
import { Transaction, TransactionStatus } from "@/services/transaction-service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Calendar,
  DollarSign,
  User,
  FileText,
  Clock,
  AlertTriangle,
  Package,
  Mail,
  Phone,
  MapPin,
  Eye,
  Pencil,
  Tag,
} from "lucide-react";
import Link from "next/link";

// ============================================
// STATUS LABELS
// ============================================

const PROPOSAL_STATUS_LABELS: Record<
  ProposalStatus,
  { label: string; color: string }
> = {
  draft: { label: "Rascunho", color: "#94a3b8" },
  in_progress: { label: "Em Aberto", color: "#3b82f6" },
  sent: { label: "Enviada", color: "#f59e0b" },
  approved: { label: "Aprovada", color: "#22c55e" },
  rejected: { label: "Rejeitada", color: "#ef4444" },
};

const TRANSACTION_STATUS_LABELS: Record<
  TransactionStatus,
  { label: string; color: string }
> = {
  pending: { label: "Pendente", color: "#f59e0b" },
  overdue: { label: "Atrasado", color: "#ef4444" },
  paid: { label: "Pago", color: "#22c55e" },
};

// ============================================
// HELPERS
// ============================================

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(
  val:
    | string
    | Date
    | { seconds?: number; _seconds?: number }
    | null
    | undefined,
): string {
  if (!val) return "-";
  try {
    // Handle Firestore Timestamp
    if (typeof val === "object" && ("_seconds" in val || "seconds" in val)) {
      const seconds = val._seconds ?? val.seconds ?? 0;
      return new Date(seconds * 1000).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }

    let dateStr = String(val);
    // Prevent timezone shift for YYYY-MM-DD strings
    if (dateStr.length === 10 && dateStr.includes("-")) {
      dateStr += "T12:00:00";
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Data Inválida";

    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Data Inválida";
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Calendar;
  label: string;
  value?: string | React.ReactNode;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={cn("flex items-start gap-3 py-2", className)}>
      <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </p>
        <div className="text-sm text-foreground mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ============================================
// PROPOSAL DETAIL MODAL
// ============================================

interface ProposalDetailModalProps {
  proposal: Proposal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProposalDetailModal({
  proposal,
  open,
  onOpenChange,
}: ProposalDetailModalProps) {
  if (!proposal) return null;

  const statusInfo = PROPOSAL_STATUS_LABELS[
    proposal.status as ProposalStatus
  ] || {
    label: proposal.status,
    color: "#94a3b8",
  };

  const totalValue =
    proposal.totalValue ||
    proposal.products?.reduce((sum, p) => sum + (p.total || 0), 0) ||
    0;

  const isExpired = proposal.validUntil
    ? new Date(proposal.validUntil) < new Date()
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: `${statusInfo.color}15`,
                color: statusInfo.color,
                borderColor: `${statusInfo.color}30`,
              }}
            >
              {statusInfo.label}
            </span>
            {isExpired && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-1 rounded-full border border-destructive/20">
                <AlertTriangle className="w-3 h-3" />
                Vencida
              </span>
            )}
          </div>
          <DialogTitle className="text-xl">{proposal.title}</DialogTitle>
          <DialogDescription>
            Criada em {formatDate(proposal.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 mt-4">
          {/* Value highlight */}
          {totalValue > 0 && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            </div>
          )}

          {/* Client info */}
          <InfoRow icon={User} label="Cliente" value={proposal.clientName} />
          <InfoRow icon={Mail} label="E-mail" value={proposal.clientEmail} />
          <InfoRow icon={Phone} label="Telefone" value={proposal.clientPhone} />
          <InfoRow
            icon={MapPin}
            label="Endereço"
            value={proposal.clientAddress}
          />

          {/* Dates */}
          <div className="border-t border-border/20 mt-3 pt-1">
            <InfoRow
              icon={Calendar}
              label="Validade"
              value={formatDate(proposal.validUntil)}
            />
          </div>

          {/* Products */}
          {proposal.products && proposal.products.length > 0 && (
            <div className="border-t border-border/20 mt-3 pt-3">
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Produtos/Serviços ({proposal.products.length})
                </span>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto kanban-scrollbar">
                {proposal.products.map((product, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg border border-border/20 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.quantity}x {formatCurrency(product.unitPrice)}
                      </p>
                    </div>
                    <span className="font-semibold text-foreground shrink-0 ml-3">
                      {formatCurrency(product.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border/20">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="gap-1.5 flex-1"
          >
            <Link href={`/proposals/${proposal.id}`}>
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </Link>
          </Button>
          {proposal.status !== "draft" && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 flex-1"
            >
              <Link href={`/proposals/${proposal.id}/view`}>
                <Eye className="w-3.5 h-3.5" />
                Ver PDF
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="ml-auto"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// TRANSACTION DETAIL MODAL
// ============================================

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailModal({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailModalProps) {
  if (!transaction) return null;

  const statusInfo = TRANSACTION_STATUS_LABELS[
    transaction.status as TransactionStatus
  ] || {
    label: transaction.status,
    color: "#94a3b8",
  };

  const isOverdue =
    transaction.dueDate && !transaction.paidAt
      ? new Date(transaction.dueDate) < new Date()
      : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: `${statusInfo.color}15`,
                color: statusInfo.color,
                borderColor: `${statusInfo.color}30`,
              }}
            >
              {statusInfo.label}
            </span>
            <span
              className={cn(
                "inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border",
                transaction.type === "income"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20",
              )}
            >
              {transaction.type === "income" ? "Receita" : "Despesa"}
            </span>
            {transaction.isPartialPayment && (
              <span className="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                Pagamento Parcial
              </span>
            )}
            <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
              {transaction.isDownPayment
                ? "Entrada"
                : transaction.isInstallment
                  ? `Parcela ${transaction.installmentNumber}/${transaction.installmentCount}`
                  : "À vista"}
            </span>
            {transaction.proposalId && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
                <FileText className="w-3 h-3" />
                Origem: Proposta
              </span>
            )}
          </div>
          <DialogTitle className="text-xl">
            {transaction.description}
          </DialogTitle>
          <DialogDescription>
            {transaction.isInstallment &&
            transaction.installmentNumber != null &&
            transaction.installmentCount != null
              ? `Parcela ${transaction.installmentNumber}/${transaction.installmentCount}`
              : `Criado em ${formatDate(transaction.createdAt)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 mt-4">
          {/* Value highlight */}
          <div
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl border mb-4",
              transaction.type === "income"
                ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/15"
                : "bg-red-500/5 dark:bg-red-500/10 border-red-500/15",
            )}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                transaction.type === "income"
                  ? "bg-emerald-500/10"
                  : "bg-red-500/10",
              )}
            >
              <DollarSign
                className={cn(
                  "w-5 h-5",
                  transaction.type === "income"
                    ? "text-emerald-500"
                    : "text-red-500",
                )}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p
                className={cn(
                  "text-lg font-bold",
                  transaction.type === "income"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500",
                )}
              >
                {transaction.type === "expense" && "- "}
                {formatCurrency(transaction.amount)}
              </p>
            </div>
          </div>

          {/* Info rows */}
          <InfoRow icon={User} label="Cliente" value={transaction.clientName} />
          <InfoRow icon={Tag} label="Categoria" value={transaction.category} />
          <InfoRow
            icon={Calendar}
            label="Vencimento"
            value={
              <span className={cn(isOverdue && "text-destructive font-medium")}>
                {formatDate(transaction.dueDate)}
                {isOverdue && " (vencido)"}
              </span>
            }
          />
          {transaction.paidAt && (
            <InfoRow
              icon={Clock}
              label="Pago em"
              value={formatDate(transaction.paidAt)}
            />
          )}
          {transaction.wallet && (
            <InfoRow
              icon={FileText}
              label="Carteira"
              value={transaction.wallet}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end mt-6 pt-4 border-t border-border/20">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
