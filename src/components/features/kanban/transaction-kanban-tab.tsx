"use client";

import * as React from "react";
import {
  KanbanBoard,
  KanbanColumn,
} from "@/components/features/kanban/kanban-board";
import { TransactionKanbanCard } from "@/components/features/kanban/kanban-card";
import { TransactionDetailModal } from "@/components/features/kanban/kanban-detail-modal";
import {
  TransactionService,
  Transaction,
  TransactionStatus,
} from "@/services/transaction-service";
import { useTenant } from "@/providers/tenant-provider";
import { KanbanBoardSkeleton } from "@/app/kanban/_components/kanban-skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normalize } from "@/utils/text";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  ListFilter,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";

import { useTransactionStatuses } from "@/app/financial/_hooks/useTransactionStatuses";

// ============================================
// STORAGE KEY
// ============================================

const AUTO_OVERDUE_KEY = "kanban_auto_overdue";

export function TransactionKanbanTab() {
  const { statuses, isLoaded, reorderStatuses } = useTransactionStatuses();
  const { tenant } = useTenant();
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [columnFilters, setColumnFilters] = React.useState<
    Record<
      string,
      {
        term: string;
        filterType: "all" | "income" | "expense";
        clientName?: string;
        minAmount?: string;
        maxAmount?: string;
        dateStart?: string;
        dateEnd?: string;
      }
    >
  >({});
  const [selectedTransaction, setSelectedTransaction] =
    React.useState<Transaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [autoOverdue, setAutoOverdue] = React.useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(AUTO_OVERDUE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Load transactions
  React.useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await TransactionService.getTransactions(tenant.id);
        if (!cancelled) setTransactions(data);
      } catch (error) {
        console.error("Failed to load transactions:", error);
        toast.error("Erro ao carregar lançamentos.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  // Base transactions apply just the autoOverdue visual logic
  const processedTransactions = React.useMemo(() => {
    let result = transactions;

    if (autoOverdue) {
      const now = new Date();
      result = result.map((t) => {
        if (t.status === "pending" && t.dueDate && new Date(t.dueDate) < now) {
          return { ...t, status: "overdue" as TransactionStatus };
        }
        return t;
      });
    }

    return result;
  }, [transactions, autoOverdue]);

  // Handle toggle
  const handleToggleAutoOverdue = React.useCallback((checked: boolean) => {
    setAutoOverdue(checked);
    try {
      localStorage.setItem(AUTO_OVERDUE_KEY, String(checked));
    } catch {
      /* localStorage may be unavailable */
    }
    toast.success(
      checked
        ? "Lançamentos pendentes vencidos serão exibidos como atrasados."
        : "Exibição automática de atrasados desativada.",
    );
  }, []);

  // Handle card click
  const handleCardClick = React.useCallback((transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsDetailOpen(true);
  }, []);

  // Handle drag end — UPDATE STATUS IN BACKEND
  const handleDragEnd = React.useCallback(
    async (itemId: string, _fromColumnId: string, toColumnId: string) => {
      const newStatus = toColumnId as TransactionStatus;
      const transaction = transactions.find((t) => t.id === itemId);
      if (!transaction || transaction.status === newStatus) return;

      const oldStatus = transaction.status;
      const targetLabel =
        statuses.find((c) => c.id === newStatus)?.label || newStatus;

      // Optimistic update
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id !== itemId) return t;
          return {
            ...t,
            status: newStatus,
            ...(newStatus === "paid"
              ? { paidAt: new Date().toISOString() }
              : {}),
            ...(newStatus !== "paid" ? { paidAt: undefined } : {}),
          };
        }),
      );

      try {
        await TransactionService.updateTransactionsStatusBatch(
          [itemId],
          newStatus,
        );
        toast.success(`Status alterado para "${targetLabel}".`, {
          title: "Lançamento atualizado",
        });
      } catch (error) {
        // Revert on failure
        setTransactions((prev) =>
          prev.map((t) => (t.id === itemId ? { ...t, status: oldStatus } : t)),
        );
        console.error("Error updating transaction status:", error);
        toast.error("Erro ao atualizar o status do lançamento.");
      }
    },
    [transactions],
  );

  // Derived unique clients for the filter dropdown
  const clientOptions = React.useMemo(() => {
    const clients = new Set<string>();
    processedTransactions.forEach((t) => {
      if (t.clientName) clients.add(t.clientName.trim());
    });
    return Array.from(clients)
      .sort()
      .map((c) => ({ value: c, label: c }));
  }, [processedTransactions]);

  // Build board columns
  const boardColumns = React.useMemo((): KanbanColumn<Transaction>[] => {
    return statuses.map((col) => {
      let items = processedTransactions.filter((t) => t.status === col.id);

      const filter = columnFilters[col.id] || {
        term: "",
        filterType: "all",
        clientName: "",
        minAmount: "",
        maxAmount: "",
        dateStart: "",
        dateEnd: "",
      };

      if (filter.filterType !== "all") {
        items = items.filter((t) => t.type === filter.filterType);
      }
      if (filter.term?.trim()) {
        const term = normalize(filter.term);
        items = items.filter(
          (t) =>
            normalize(t.description || "").includes(term) ||
            normalize(t.category || "").includes(term),
        );
      }
      if (filter.clientName?.trim()) {
        const clientTerm = normalize(filter.clientName);
        items = items.filter((t) =>
          normalize(t.clientName || "").includes(clientTerm),
        );
      }
      if (filter.minAmount && !isNaN(Number(filter.minAmount))) {
        items = items.filter((t) => t.amount >= Number(filter.minAmount));
      }
      if (filter.maxAmount && !isNaN(Number(filter.maxAmount))) {
        items = items.filter((t) => t.amount <= Number(filter.maxAmount));
      }
      if (filter.dateStart) {
        items = items.filter(
          (t) =>
            t.date >= filter.dateStart! ||
            (t.dueDate && t.dueDate >= filter.dateStart!),
        );
      }
      if (filter.dateEnd) {
        items = items.filter(
          (t) =>
            t.date <= filter.dateEnd! ||
            (t.dueDate && t.dueDate <= filter.dateEnd!),
        );
      }

      return {
        id: col.id,
        label: col.label,
        color: col.color,
        items,
      };
    });
  }, [processedTransactions, columnFilters, statuses]);

  // Column header renderer with icons and totals
  const renderColumnHeader = React.useCallback(
    (column: KanbanColumn<Transaction>, count: number) => {
      const colConfig = statuses.find((c) => c.id === column.id);
      const Icon = colConfig?.icon || Clock;
      const total = column.items.reduce((sum, t) => sum + (t.amount || 0), 0);

      const filter = columnFilters[column.id] || {
        term: "",
        filterType: "all",
        clientName: "",
        minAmount: "",
        maxAmount: "",
        dateStart: "",
        dateEnd: "",
      };

      const hasFilterActive =
        filter.term ||
        filter.filterType !== "all" ||
        filter.clientName ||
        filter.minAmount ||
        filter.maxAmount ||
        filter.dateStart ||
        filter.dateEnd;

      const updateFilter = (
        key:
          | "term"
          | "filterType"
          | "clientName"
          | "minAmount"
          | "maxAmount"
          | "dateStart"
          | "dateEnd",
        value: string,
      ) => {
        setColumnFilters((prev) => ({
          ...prev,
          [column.id]: {
            ...(prev[column.id] || {
              term: "",
              filterType: "all",
              clientName: "",
              minAmount: "",
              maxAmount: "",
              dateStart: "",
              dateEnd: "",
            }),
            [key]: value,
          },
        }));
      };

      const clearFilter = () => {
        setColumnFilters((prev) => {
          const next = { ...prev };
          delete next[column.id];
          return next;
        });
      };

      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${column.color}15` }}
              >
                <Icon className="w-4 h-4" style={{ color: column.color }} />
              </div>
              <span className="text-sm font-semibold text-foreground truncate">
                {column.label}
              </span>
              <span className="text-xs font-medium text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-full tabular-nums shrink-0">
                {count}
              </span>
            </div>

            {/* Column Specific Filter Icon */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "p-1.5 rounded-md transition-colors shrink-0",
                    hasFilterActive
                      ? "bg-primary/10 text-primary hover:bg-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  title="Filtros da coluna"
                >
                  <ListFilter className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[340px] p-4 shadow-xl border-border/40"
                align="end"
              >
                <div
                  className="space-y-4"
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between outline-none pointer-events-none pb-1 border-b">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Filtros da Coluna
                    </h4>
                    {hasFilterActive && (
                      <button
                        type="button"
                        className="pointer-events-auto text-[10px] font-bold text-destructive hover:text-destructive/80 transition-colors uppercase tracking-wider"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearFilter();
                        }}
                      >
                        Limpar Filtros
                      </button>
                    )}
                  </div>

                  {/* Text Search */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Descrição / Categoria
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Buscar..."
                        value={filter.term || ""}
                        onChange={(e) => updateFilter("term", e.target.value)}
                        className="pl-8 h-8 text-xs bg-muted/30"
                      />
                    </div>
                  </div>

                  {/* Client Search */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Cliente
                    </label>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <SearchableSelect
                        options={clientOptions}
                        value={filter.clientName || ""}
                        onValueChange={(val: string) =>
                          updateFilter("clientName", val)
                        }
                        placeholder="Todos os clientes..."
                        searchPlaceholder="Buscar cliente..."
                        className="h-8 text-xs [&>div>input]:h-8 [&>div>input]:text-xs [&>select]:h-8 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Value Range */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Valor (R$)
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filter.minAmount || ""}
                        onChange={(e) =>
                          updateFilter("minAmount", e.target.value)
                        }
                        className="h-8 text-xs bg-muted/30 rounded-md"
                      />
                      <span className="text-muted-foreground text-xs">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filter.maxAmount || ""}
                        onChange={(e) =>
                          updateFilter("maxAmount", e.target.value)
                        }
                        className="h-8 text-xs bg-muted/30 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Date Range */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Data (Vencimento ou Emissão)
                    </label>
                    <div className="flex items-center gap-3">
                      <DatePicker
                        value={filter.dateStart || ""}
                        onChange={(e) =>
                          updateFilter("dateStart", e.target.value)
                        }
                        className="h-8 text-xs bg-muted/30 w-full rounded-md px-3"
                      />
                      <span className="text-muted-foreground text-xs text-center w-4">
                        a
                      </span>
                      <DatePicker
                        value={filter.dateEnd || ""}
                        onChange={(e) =>
                          updateFilter("dateEnd", e.target.value)
                        }
                        className="h-8 text-xs bg-muted/30 w-full rounded-md px-3"
                      />
                    </div>
                  </div>

                  {/* Type Filter */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Tipo
                    </label>
                    <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/40">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateFilter("filterType", "all");
                        }}
                        className={cn(
                          "flex-1 px-1 py-1 text-[10px] font-medium rounded-md transition-colors bg-transparent",
                          !filter.filterType || filter.filterType === "all"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                        )}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateFilter("filterType", "income");
                        }}
                        className={cn(
                          "flex-1 px-1 py-1 text-[10px] font-medium rounded-md transition-colors bg-transparent",
                          filter.filterType === "income"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                        )}
                      >
                        Receitas
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateFilter("filterType", "expense");
                        }}
                        className={cn(
                          "flex-1 px-1 py-1 text-[10px] font-medium rounded-md transition-colors bg-transparent",
                          filter.filterType === "expense"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                        )}
                      >
                        Despesas
                      </button>
                    </div>
                  </div>

                  {hasFilterActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs h-8 mt-2 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFilter();
                      }}
                    >
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {total > 0 && (
            <div className="text-xs font-medium text-muted-foreground pl-[38px]">
              {total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
          )}
        </div>
      );
    },
    [columnFilters, clientOptions, statuses],
  );

  if (isLoading || !isLoaded) {
    return (
      <div className="flex-1 w-full mt-4">
        <KanbanBoardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-start gap-3 flex-wrap">
        {/* Drag hint */}
        <p className="text-xs text-muted-foreground hidden sm:block">
          Arraste para alterar o status
        </p>
        {/* Auto-overdue toggle */}
        <div className="flex items-center gap-3 bg-card/60 dark:bg-card/40 border border-border/40 rounded-lg px-3 py-2 backdrop-blur-sm">
          <label
            htmlFor="auto-overdue-toggle"
            className="text-xs text-muted-foreground select-none cursor-pointer"
          >
            Marcar vencidos como atrasados
          </label>
          <Switch
            id="auto-overdue-toggle"
            checked={autoOverdue}
            onCheckedChange={handleToggleAutoOverdue}
          />
        </div>
      </div>

      {/* Board — Drag ENABLED for transactions */}
      <KanbanBoard<Transaction>
        columns={boardColumns}
        onDragEnd={handleDragEnd}
        onColumnDragEnd={reorderStatuses}
        onCardClick={handleCardClick}
        getItemId={(t) => t.id}
        isDragEnabled={true}
        showColumnTotals
        getItemValue={(t) => t.amount}
        renderCard={(transaction, _col, isDragging) => (
          <TransactionKanbanCard
            description={transaction.description}
            amount={transaction.amount}
            type={transaction.type}
            dueDate={transaction.dueDate}
            clientName={transaction.clientName}
            isPartialPayment={transaction.isPartialPayment}
            isInstallment={transaction.isInstallment}
            installmentNumber={transaction.installmentNumber}
            installmentCount={transaction.installmentCount}
            category={transaction.category}
            paidAt={transaction.paidAt}
            status={transaction.status}
            isDragging={isDragging}
            isDownPayment={transaction.isDownPayment}
            proposalId={transaction.proposalId}
          />
        )}
        renderColumnHeader={renderColumnHeader}
        emptyMessage="Nenhum lançamento"
      />

      {/* Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) setSelectedTransaction(null);
        }}
      />
    </div>
  );
}
