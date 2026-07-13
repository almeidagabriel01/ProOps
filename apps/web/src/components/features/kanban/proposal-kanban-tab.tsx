"use client";

import * as React from "react";
import {
  KanbanBoard,
  KanbanColumn,
} from "@/components/features/kanban/kanban-board";
import { ProposalKanbanCard } from "@/components/features/kanban/kanban-card";
import { ProposalDetailModal } from "@/components/features/kanban/kanban-detail-modal";
import { KanbanStatusDialog } from "@/components/features/kanban/kanban-status-dialog";
import {
  KanbanService,
  KanbanStatusColumn,
  getDefaultProposalColumns,
} from "@/services/kanban-service";
import { ProposalService } from "@/services/proposal-service";
import {
  KanbanBoardService,
  type KanbanColumnCursor,
} from "@/services/kanban-board-service";
import { Proposal } from "@/types/proposal";
import { useTenant } from "@/providers/tenant-provider";
import { KanbanBoardSkeleton } from "@/app/crm/_components/kanban-skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { Plus, Pencil, Trash2, Search, ListFilter } from "lucide-react";
import { isDateBeforeTodayBR } from "@/utils/date-format";
import { cn } from "@/lib/utils";
import { normalize } from "@/utils/text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader } from "@/components/ui/loader";

interface ColumnPageState {
  cursor: KanbanColumnCursor | null;
  hasMore: boolean;
  total: number;
  isLoadingMore: boolean;
}

/**
 * Statuses de proposta que a coluna representa: o id da coluna persistida
 * (drags novos gravam status = doc id) + o mappedStatus legado. Colunas
 * virtuais (default_*) só têm o mappedStatus.
 */
function getColumnStatusValues(col: KanbanStatusColumn): string[] {
  const values: string[] = [];
  if (!col.id.startsWith("default_")) values.push(col.id);
  if (col.mappedStatus) values.push(col.mappedStatus);
  return Array.from(new Set(values));
}

function columnStatusKey(col: KanbanStatusColumn): string {
  return getColumnStatusValues(col).slice().sort().join("|");
}

function mergeById<T extends { id: string }>(prev: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return prev;
  const known = new Set(prev.map((item) => item.id));
  const fresh = incoming.filter((item) => !known.has(item.id));
  return fresh.length > 0 ? [...prev, ...fresh] : prev;
}

export function ProposalKanbanTab() {
  const { tenant, isReadOnly } = useTenant();
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [columns, setColumns] = React.useState<KanbanStatusColumn[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = React.useState(false);
  const [editingColumn, setEditingColumn] =
    React.useState<KanbanStatusColumn | null>(null);
  const [deletingColumnId, setDeletingColumnId] = React.useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeletingColumn, setIsDeletingColumn] = React.useState(false);
  const [columnFilters, setColumnFilters] = React.useState<
    Record<
      string,
      {
        term: string;
        filterExpiration: "all" | "valid" | "expired";
        clientName?: string;
        minAmount?: string;
        maxAmount?: string;
        dateStart?: string;
        dateEnd?: string;
      }
    >
  >({});
  const [selectedProposal, setSelectedProposal] =
    React.useState<Proposal | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  // Per-column pagination state, keyed by columnStatusKey()
  const [columnMeta, setColumnMeta] = React.useState<
    Record<string, ColumnPageState>
  >({});
  const [isBoardLoading, setIsBoardLoading] = React.useState(true);
  const columnMetaRef = React.useRef(columnMeta);
  columnMetaRef.current = columnMeta;

  // Load kanban statuses (columns)
  React.useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setColumns([]);
      setProposals([]);
      setColumnMeta({});
      setIsBoardLoading(true);
      try {
        const statusData = await KanbanService.getStatuses(tenant.id);

        if (cancelled) return;

        // If no custom columns exist, use defaults
        if (statusData.length === 0) {
          const defaults = getDefaultProposalColumns();
          const virtualColumns: KanbanStatusColumn[] = defaults.map((d, i) => ({
            ...d,
            id: `default_${i}`,
            tenantId: tenant.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));
          setColumns(virtualColumns);
        } else {
          setColumns(statusData);
        }
      } catch (error) {
        console.error("Failed to load kanban data:", error);
        toast.error("Erro ao carregar dados do CRM.");
        if (!cancelled) setIsBoardLoading(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tenant?.id]);

  // Signature of the status keys the columns require — each key is the
  // "|"-joined sorted status values of one column (recoverable via split).
  const columnsSignature = React.useMemo(
    () =>
      Array.from(new Set(columns.map(columnStatusKey).filter(Boolean)))
        .sort()
        .join(","),
    [columns],
  );

  // Load the first page (capped) + server-side count for each column
  React.useEffect(() => {
    const tenantId = tenant?.id;
    if (!tenantId || !columnsSignature) return;

    const keys = columnsSignature.split(",").filter(Boolean);
    const missing = keys.filter((key) => !columnMetaRef.current[key]);
    if (missing.length === 0) {
      setIsBoardLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const results = await Promise.all(
          missing.map(async (key) => {
            const values = key.split("|");
            const [page, total] = await Promise.all([
              KanbanBoardService.getProposalColumnPage(tenantId, values),
              KanbanBoardService.countProposalColumn(tenantId, values),
            ]);
            return { key, page, total };
          }),
        );
        if (cancelled) return;

        // Filter out drafts for kanban view
        setProposals((prev) =>
          mergeById(
            prev,
            results
              .flatMap((r) => r.page.items)
              .filter((p) => p.status !== "draft"),
          ),
        );
        setColumnMeta((prev) => {
          const next = { ...prev };
          for (const r of results) {
            next[r.key] = {
              cursor: r.page.cursor,
              hasMore: r.page.hasMore,
              total: r.total,
              isLoadingMore: false,
            };
          }
          return next;
        });
      } catch (error) {
        console.error("Failed to load kanban column pages:", error);
        if (!cancelled) toast.error("Erro ao carregar propostas do CRM.");
      } finally {
        if (!cancelled) setIsBoardLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tenant?.id, columnsSignature]);

  // Load next page of a column (cursor-based)
  const handleLoadMore = React.useCallback(
    async (columnId: string) => {
      if (!tenant?.id) return;
      const col = columns.find((c) => c.id === columnId);
      if (!col) return;
      const key = columnStatusKey(col);
      const meta = columnMetaRef.current[key];
      if (!meta || !meta.hasMore || meta.isLoadingMore) return;

      setColumnMeta((prev) => ({
        ...prev,
        [key]: { ...prev[key], isLoadingMore: true },
      }));
      try {
        const page = await KanbanBoardService.getProposalColumnPage(
          tenant.id,
          getColumnStatusValues(col),
          { cursor: meta.cursor },
        );
        setProposals((prev) =>
          mergeById(
            prev,
            page.items.filter((p) => p.status !== "draft"),
          ),
        );
        setColumnMeta((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            cursor: page.cursor ?? prev[key].cursor,
            hasMore: page.hasMore,
            isLoadingMore: false,
          },
        }));
      } catch (error) {
        console.error("Failed to load more proposals:", error);
        toast.error("Erro ao carregar mais propostas.");
        setColumnMeta((prev) => ({
          ...prev,
          [key]: { ...prev[key], isLoadingMore: false },
        }));
      }
    },
    [tenant?.id, columns],
  );

  // Filter and Build board columns
  const boardColumns = React.useMemo((): KanbanColumn<Proposal>[] => {
    return columns.map((col) => {
      let items = proposals.filter(
        (p) =>
          p.status === col.id ||
          (col.mappedStatus && p.status === col.mappedStatus),
      );
      const filter = columnFilters[col.id] || {
        term: "",
        filterExpiration: "all",
      };

      if (filter.filterExpiration !== "all") {
        items = items.filter((p) => {
          if (!p.validUntil) return filter.filterExpiration === "valid";
          const isValid = !isDateBeforeTodayBR(p.validUntil);
          return filter.filterExpiration === "valid" ? isValid : !isValid;
        });
      }

      if (filter.term?.trim()) {
        const term = normalize(filter.term);
        items = items.filter((p) => normalize(p.title || "").includes(term));
      }

      if (filter.clientName?.trim()) {
        const clientTerm = normalize(filter.clientName);
        items = items.filter((p) =>
          normalize(p.clientName || "").includes(clientTerm),
        );
      }

      const getProposalTotal = (p: Proposal) =>
        p.totalValue ||
        p.products?.reduce((s, pr) => s + (pr.total || 0), 0) ||
        0;

      if (filter.minAmount && !isNaN(Number(filter.minAmount))) {
        items = items.filter(
          (p) => getProposalTotal(p) >= Number(filter.minAmount),
        );
      }
      if (filter.maxAmount && !isNaN(Number(filter.maxAmount))) {
        items = items.filter(
          (p) => getProposalTotal(p) <= Number(filter.maxAmount),
        );
      }
      if (filter.dateStart) {
        items = items.filter(
          (p) =>
            (p.createdAt && p.createdAt >= filter.dateStart!) ||
            (p.validUntil && p.validUntil >= filter.dateStart!),
        );
      }
      if (filter.dateEnd) {
        items = items.filter(
          (p) =>
            (p.createdAt && p.createdAt <= filter.dateEnd!) ||
            (p.validUntil && p.validUntil <= filter.dateEnd!),
        );
      }

      // Keep column order aligned with the paginated query (createdAt desc)
      items.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );

      return {
        id: col.id,
        label: col.label,
        color: col.color,
        items,
      };
    });
  }, [columns, proposals, columnFilters]);

  // Derived unique clients for the filter dropdown
  const clientOptions = React.useMemo(() => {
    const clients = new Set<string>();
    proposals.forEach((p) => {
      if (p.clientName) clients.add(p.clientName.trim());
    });
    return Array.from(clients)
      .sort()
      .map((c) => ({ value: c, label: c }));
  }, [proposals]);

  // Shift server-count totals when a card moves between columns
  const adjustColumnTotals = React.useCallback(
    (fromKey: string | null, toKey: string | null) => {
      if (!fromKey || !toKey || fromKey === toKey) return;
      setColumnMeta((prev) => {
        const next = { ...prev };
        if (next[fromKey]) {
          next[fromKey] = {
            ...next[fromKey],
            total: Math.max(0, next[fromKey].total - 1),
          };
        }
        if (next[toKey]) {
          next[toKey] = { ...next[toKey], total: next[toKey].total + 1 };
        }
        return next;
      });
    },
    [],
  );

  // Handle drag end — update proposal status
  const handleDragEnd = React.useCallback(
    async (itemId: string, fromColumnId: string, toColumnId: string) => {
      const targetColumn = columns.find((c) => c.id === toColumnId);
      if (!targetColumn) return;

      const newStatus =
        targetColumn.id.startsWith("default_") && targetColumn.mappedStatus
          ? targetColumn.mappedStatus
          : targetColumn.id;
      const proposal = proposals.find((p) => p.id === itemId);
      if (!proposal || proposal.status === newStatus) return;

      const fromColumn = columns.find((c) => c.id === fromColumnId);
      const fromKey = fromColumn ? columnStatusKey(fromColumn) : null;
      const toKey = columnStatusKey(targetColumn);

      // Optimistic update
      setProposals((prev) =>
        prev.map((p) => (p.id === itemId ? { ...p, status: newStatus } : p)),
      );
      adjustColumnTotals(fromKey, toKey);

      try {
        await ProposalService.updateProposal(itemId, { status: newStatus });
        toast.success(`Status alterado para "${targetColumn.label}".`, {
          title: "Status atualizado",
        });
      } catch (error) {
        // Revert on failure
        setProposals((prev) =>
          prev.map((p) =>
            p.id === itemId ? { ...p, status: proposal.status } : p,
          ),
        );
        adjustColumnTotals(toKey, fromKey);
        console.error("Error updating proposal status:", error);
        toast.error("Erro ao atualizar o status da proposta.");
      }
    },
    [columns, proposals, adjustColumnTotals],
  );

  // Handle card click — open detail modal
  const handleCardClick = React.useCallback((proposal: Proposal) => {
    setSelectedProposal(proposal);
    setIsDetailOpen(true);
  }, []);

  // Helper to persist defaults if they haven't been saved yet
  const persistDefaultsIfNeeded = React.useCallback(async (): Promise<
    KanbanStatusColumn[] | null
  > => {
    if (!tenant?.id) return null;
    const isUsingDefaults =
      columns.length > 0 && columns.every((c) => c.id.startsWith("default_"));
    if (!isUsingDefaults) return columns;

    setIsSaving(true);
    try {
      const persistedColumns = await Promise.all(
        columns.map((col, index) =>
          KanbanService.createStatus({
            tenantId: tenant.id,
            label: col.label,
            color: col.color,
            order: index,
            category: col.category,
            mappedStatus: col.mappedStatus || undefined,
          }),
        ),
      );
      setColumns(persistedColumns);
      return persistedColumns;
    } catch (error) {
      console.error("Error persisting defaults", error);
      toast.error("Erro ao inicializar quadro CRM.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [tenant?.id, columns]);

  const handleRestoreDefaults = async () => {
    if (!tenant?.id) return;
    setIsSaving(true);
    try {
      const defaults = getDefaultProposalColumns();
      const existingMapped = new Set(
        columns.map((c) => c.mappedStatus).filter(Boolean),
      );

      const missingDefaults = defaults.filter(
        (d) => d.mappedStatus && !existingMapped.has(d.mappedStatus),
      );

      if (missingDefaults.length === 0) {
        toast.info("Todas as colunas padrão já existem no seu quadro.");
        setIsSaving(false);
        return;
      }

      const maxOrder = Math.max(...columns.map((c) => c.order), -1);

      const restored = await Promise.all(
        missingDefaults.map((col, index) =>
          KanbanService.createStatus({
            tenantId: tenant.id,
            label: col.label,
            color: col.color,
            order: maxOrder + 1 + index,
            category: col.category,
            mappedStatus: col.mappedStatus || undefined,
          }),
        ),
      );

      setColumns((prev) => [...prev, ...restored]);
      toast.success(`${restored.length} coluna(s) padrão restaurada(s).`);
    } catch (e) {
      console.error("Error restoring defaults", e);
      toast.error("Erro ao restaurar colunas padrão.");
    } finally {
      setIsSaving(false);
    }
  };

  const isMissingDefaults = React.useMemo(() => {
    const defaults = getDefaultProposalColumns();
    const existingMapped = new Set(
      columns.map((c) => c.mappedStatus).filter(Boolean),
    );
    return defaults.some(
      (d) => d.mappedStatus && !existingMapped.has(d.mappedStatus),
    );
  }, [columns]);

  // Handle create/edit column
  const handleSaveColumn = React.useCallback(
    async (data: {
      label: string;
      color: string;
      category: "open" | "won" | "lost";
    }) => {
      if (!tenant?.id) return;
      setIsSaving(true);

      try {
        // Persist defaults if this is the first mutation
        let activeColumns = columns;
        if (
          columns.length > 0 &&
          columns.every((c) => c.id.startsWith("default_"))
        ) {
          const persisted = await persistDefaultsIfNeeded();
          if (persisted) activeColumns = persisted;
        }

        if (editingColumn) {
          // If editing a default column, find its newly persisted ID
          let targetId = editingColumn.id;
          if (targetId.startsWith("default_")) {
            const newlyPersisted = activeColumns.find(
              (c) =>
                c.mappedStatus === editingColumn.mappedStatus ||
                c.label === editingColumn.label,
            );
            if (newlyPersisted) targetId = newlyPersisted.id;
          }

          if (targetId.startsWith("default_")) {
            // Fallback in case persistence failed but we still try to create (shouldn't happen)
            const newColumn = await KanbanService.createStatus({
              tenantId: tenant.id,
              label: data.label,
              color: data.color,
              order: editingColumn.order,
              category: data.category,
              mappedStatus: editingColumn.mappedStatus,
            });
            setColumns((prev) =>
              prev.map((c) =>
                c.id === editingColumn.id || c.id === targetId ? newColumn : c,
              ),
            );
          } else {
            await KanbanService.updateStatus(targetId, data);
            setColumns((prev) =>
              prev.map((c) =>
                c.id === targetId
                  ? { ...c, ...data, updatedAt: new Date().toISOString() }
                  : c,
              ),
            );
          }
          toast.success("Coluna atualizada com sucesso.");
        } else {
          const maxOrder = Math.max(...columns.map((c) => c.order), -1);
          const newColumn = await KanbanService.createStatus({
            tenantId: tenant.id,
            label: data.label,
            color: data.color,
            order: maxOrder + 1,
            category: data.category,
          });
          setColumns((prev) => [...prev, newColumn]);
          toast.success("Coluna criada com sucesso.");
        }
      } catch (error) {
        console.error("Error saving column:", error);
        toast.error("Erro ao salvar coluna.");
      } finally {
        setIsSaving(false);
        setIsStatusDialogOpen(false);
        setEditingColumn(null);
      }
    },
    [tenant?.id, editingColumn, columns, persistDefaultsIfNeeded],
  );

  const onColumnDragEnd = React.useCallback(
    async (orderedIds: string[]) => {
      if (!tenant?.id) return;

      let activeColumns = columns;
      // Persist defaults first if needed
      if (
        columns.length > 0 &&
        columns.every((c) => c.id.startsWith("default_"))
      ) {
        const persisted = await persistDefaultsIfNeeded();
        if (persisted) activeColumns = persisted;
      }

      // Map ordered IDs back to columns and set new order
      const reorderedColumns = orderedIds
        .map((id) => {
          if (id.startsWith("default_")) {
            const defaultCol = columns.find((c) => c.id === id);
            return activeColumns.find(
              (c) =>
                c.mappedStatus === defaultCol?.mappedStatus ||
                c.label === defaultCol?.label,
            );
          }
          return activeColumns.find((c) => c.id === id);
        })
        .filter((c): c is KanbanStatusColumn => c !== undefined)
        .map((c, i) => ({ ...c, order: i }));

      if (reorderedColumns.length !== activeColumns.length) return;

      // Update local state immediately for optimistic UI
      setColumns(reorderedColumns);

      try {
        // Send the reorder request
        const statusIds = reorderedColumns.map((c) => c.id);
        await KanbanService.reorderStatuses(statusIds);
      } catch (error) {
        console.error("Error reordering columns:", error);
        toast.error("Erro ao reordenar colunas.");
        setColumns(activeColumns); // revert
      }
    },
    [columns, tenant?.id, persistDefaultsIfNeeded],
  );

  const handleDeleteColumn = React.useCallback(async () => {
    if (!deletingColumnId) return;
    setIsDeletingColumn(true);
    try {
      let activeColumns = columns;
      if (
        columns.length > 0 &&
        columns.every((c) => c.id.startsWith("default_"))
      ) {
        const persisted = await persistDefaultsIfNeeded();
        if (persisted) activeColumns = persisted;
      }

      let targetId = deletingColumnId;
      if (targetId.startsWith("default_")) {
        const colToDelete = columns.find((c) => c.id === deletingColumnId);
        const newlyPersisted = activeColumns.find(
          (c) =>
            c.mappedStatus === colToDelete?.mappedStatus ||
            c.label === colToDelete?.label,
        );
        if (newlyPersisted) targetId = newlyPersisted.id;
      }

      if (!targetId.startsWith("default_")) {
        await KanbanService.deleteStatus(targetId);
      }
      setColumns((prev) =>
        prev.filter((c) => c.id !== targetId && c.id !== deletingColumnId),
      );
      toast.success("Coluna removida com sucesso.");
    } catch (error) {
      console.error("Error deleting column:", error);
      toast.error("Erro ao remover coluna.");
    } finally {
      setIsDeletingColumn(false);
      setDeletingColumnId(null);
    }
  }, [deletingColumnId, columns, persistDefaultsIfNeeded]);

  // Column header renderer
  const renderColumnHeader = React.useCallback(
    (column: KanbanColumn<Proposal>, count: number) => {
      const col = columns.find((c) => c.id === column.id);
      const total = column.items.reduce(
        (sum, p) =>
          sum +
          (p.totalValue ||
            p.products?.reduce((s, pr) => s + (pr.total || 0), 0) ||
            0),
        0,
      );

      const filter = columnFilters[column.id] || {
        term: "",
        filterExpiration: "all",
        clientName: "",
        minAmount: "",
        maxAmount: "",
        dateStart: "",
        dateEnd: "",
      };

      const hasFilterActive =
        filter.term ||
        filter.filterExpiration !== "all" ||
        filter.clientName ||
        filter.minAmount ||
        filter.maxAmount ||
        filter.dateStart ||
        filter.dateEnd;

      // Server-side total (aggregation) — the column only loads pages of 30;
      // with local filters active, show the filtered (loaded) count instead.
      const meta = col ? columnMeta[columnStatusKey(col)] : undefined;
      const displayCount = hasFilterActive || !meta ? count : meta.total;

      const updateFilter = (
        key:
          | "term"
          | "filterExpiration"
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
              filterExpiration: "all",
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
            <div className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{
                  backgroundColor: column.color,
                  boxShadow: `0 0 8px ${column.color}40`,
                }}
              />
              <span className="text-sm font-semibold text-foreground truncate max-w-[140px]">
                {column.label}
              </span>
              <span className="text-xs font-medium text-muted-foreground bg-muted/80 px-2.5 py-1 rounded-full tabular-nums">
                {displayCount}
              </span>
            </div>
            <div className="flex items-center gap-0.5 ml-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "p-1.5 rounded-md transition-colors shrink-0 mr-1 cursor-pointer",
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
                          className="pointer-events-auto text-[10px] font-bold text-destructive hover:text-destructive/80 transition-colors uppercase tracking-wider cursor-pointer"
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
                        Título da Proposta
                      </label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Buscar..."
                          value={filter.term || ""}
                          onChange={(e) => updateFilter("term", e.target.value)}
                          className="pl-8 h-8 text-xs bg-muted/30 rounded-md"
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
                        Valor Total (R$)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={filter.minAmount || ""}
                            onChange={(e) =>
                              updateFilter("minAmount", e.target.value)
                            }
                            className="h-8 text-xs bg-muted/30 w-full rounded-md"
                          />
                        </div>
                        <span className="text-muted-foreground text-xs shrink-0 w-4 text-center">
                          -
                        </span>
                        <div className="flex-1">
                          <Input
                            type="number"
                            placeholder="Max"
                            value={filter.maxAmount || ""}
                            onChange={(e) =>
                              updateFilter("maxAmount", e.target.value)
                            }
                            className="h-8 text-xs bg-muted/30 w-full rounded-md"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Data (Criação ou Validade)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <DatePicker
                            value={filter.dateStart || ""}
                            onChange={(e) =>
                              updateFilter("dateStart", e.target.value)
                            }
                            className="h-8 text-xs bg-muted/30 w-full rounded-md px-3"
                          />
                        </div>
                        <span className="text-muted-foreground text-xs shrink-0 w-4 text-center">
                          a
                        </span>
                        <div className="flex-1">
                          <DatePicker
                            value={filter.dateEnd || ""}
                            onChange={(e) =>
                              updateFilter("dateEnd", e.target.value)
                            }
                            className="h-8 text-xs bg-muted/30 w-full rounded-md px-3"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Validity Type */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Vencimento
                      </label>
                      <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/40">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFilter("filterExpiration", "all");
                          }}
                          className={cn(
                            "flex-1 px-1 py-1 text-[10px] font-medium rounded-md transition-colors bg-transparent cursor-pointer",
                            !filter.filterExpiration ||
                              filter.filterExpiration === "all"
                              ? "bg-background shadow-sm text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                          )}
                        >
                          Todas
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFilter("filterExpiration", "valid");
                          }}
                          className={cn(
                            "flex-1 px-1 py-1 text-[10px] font-medium rounded-md transition-colors bg-transparent cursor-pointer",
                            filter.filterExpiration === "valid"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                          )}
                        >
                          No Prazo
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFilter("filterExpiration", "expired");
                          }}
                          className={cn(
                            "flex-1 px-1 py-1 text-[10px] font-medium rounded-md transition-colors bg-transparent cursor-pointer",
                            filter.filterExpiration === "expired"
                              ? "bg-red-500/10 text-red-600 dark:text-red-400 shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-transparent",
                          )}
                        >
                          Vencidas
                        </button>
                      </div>
                    </div>

                    {hasFilterActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-8 mt-2 hover:bg-destructive/10 hover:text-destructive cursor-pointer"
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
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => {
                  if (col) {
                    setEditingColumn(col);
                    setIsStatusDialogOpen(true);
                  }
                }}
                className="p-1.5 ml-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                title="Editar coluna"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setDeletingColumnId(column.id)}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                title="Excluir coluna"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {total > 0 && (
            <div className="text-xs font-medium text-muted-foreground pl-[22px]">
              {total.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
          )}
        </div>
      );
    },
    [columns, columnFilters, clientOptions, columnMeta, isReadOnly],
  );

  // Column footer — "Carregar mais" when the server still has docs
  const renderColumnFooter = React.useCallback(
    (column: KanbanColumn<Proposal>) => {
      const col = columns.find((c) => c.id === column.id);
      const meta = col ? columnMeta[columnStatusKey(col)] : undefined;
      if (!meta?.hasMore) return null;
      return (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 gap-2 cursor-pointer text-muted-foreground hover:text-foreground"
          disabled={meta.isLoadingMore}
          onClick={() => handleLoadMore(column.id)}
        >
          {meta.isLoadingMore && <Loader size="sm" />}
          {meta.isLoadingMore ? "Carregando..." : "Carregar mais"}
        </Button>
      );
    },
    [columns, columnMeta, handleLoadMore],
  );

  if (isLoading || isBoardLoading) {
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
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditingColumn(null);
              setIsStatusDialogOpen(true);
            }}
            size="sm"
            variant="outline"
            disabled={isReadOnly}
            className="gap-1.5 h-9 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Coluna
          </Button>
          {isMissingDefaults && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-9 cursor-pointer text-muted-foreground hover:text-foreground"
              onClick={handleRestoreDefaults}
              disabled={isSaving || isReadOnly}
            >
              Restaurar Padrões
            </Button>
          )}

          {!isReadOnly && (
            <p className="text-xs text-muted-foreground hidden sm:block">
              Arraste para alterar o status
            </p>
          )}
        </div>
      </div>

      {/* Board */}
      <KanbanBoard<Proposal>
        columns={boardColumns}
        onDragEnd={handleDragEnd}
        onColumnDragEnd={onColumnDragEnd}
        onCardClick={handleCardClick}
        isDragEnabled={!isReadOnly}
        getItemId={(p) => p.id}
        showColumnTotals
        getItemValue={(p) =>
          p.totalValue ||
          p.products?.reduce((s, pr) => s + (pr.total || 0), 0) ||
          0
        }
        renderCard={(proposal, _col, isDragging) => (
          <ProposalKanbanCard
            title={proposal.title}
            clientName={proposal.clientName}
            totalValue={proposal.totalValue}
            createdAt={proposal.createdAt}
            validUntil={proposal.validUntil}
            productCount={proposal.products?.length}
            status={proposal.status}
            isDragging={isDragging}
          />
        )}
        renderColumnHeader={renderColumnHeader}
        renderColumnFooter={renderColumnFooter}
        emptyMessage="Nenhuma proposta"
      />

      {/* Detail Modal */}
      <ProposalDetailModal
        proposal={selectedProposal}
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) setSelectedProposal(null);
        }}
      />

      {/* Status Column Dialog */}
      <KanbanStatusDialog
        open={isStatusDialogOpen}
        onOpenChange={(open: boolean) => {
          setIsStatusDialogOpen(open);
          if (!open) setEditingColumn(null);
        }}
        onSave={handleSaveColumn}
        initialData={
          editingColumn
            ? {
                label: editingColumn.label,
                color: editingColumn.color,
                category: editingColumn.category,
              }
            : undefined
        }
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingColumnId}
        onOpenChange={(open: boolean) => {
          if (isDeletingColumn) return;
          if (!open) setDeletingColumnId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta coluna? As propostas não serão
              excluídas, apenas a coluna do Kanban.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeletingColumn}
              onClick={(e) => {
                if (isDeletingColumn) e.preventDefault();
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteColumn();
              }}
              disabled={isDeletingColumn}
              className="bg-destructive hover:bg-destructive/90 gap-2"
            >
              {isDeletingColumn && <Loader size="sm" />}
              {isDeletingColumn ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
