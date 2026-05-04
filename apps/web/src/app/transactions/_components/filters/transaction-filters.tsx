"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  Layers,
  ListOrdered,
  X,
} from "lucide-react";
import type { TransactionType, TransactionStatus } from "@/services/transaction-service";
import type { Wallet } from "@/types";
import { WalletService } from "@/services/wallet-service";
import { useTenant } from "@/providers/tenant-provider";
import { FilterSegmented } from "./filter-segmented";
import { FilterStatusPills } from "./filter-status-pills";
import { FilterPeriod } from "./filter-period";
import { FilterClearButton } from "./filter-clear-button";

interface TransactionFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filterType: TransactionType | "all";
  onFilterChange: (type: TransactionType | "all") => void;
  filterStatus: TransactionStatus[];
  onStatusChange: (status: TransactionStatus[]) => void;
  filterWallet: string;
  onWalletChange: (wallet: string) => void;
  filterStartDate?: string;
  onStartDateChange?: (date: string) => void;
  filterEndDate?: string;
  onEndDateChange?: (date: string) => void;
  filterDateType?: "date" | "dueDate";
  onDateTypeChange?: (type: "date" | "dueDate") => void;
  sortBy?: "date" | "created";
  onSortChange?: (sort: "date" | "created") => void;
  viewMode?: "grouped" | "byDueDate";
  onViewModeChange?: (mode: "grouped" | "byDueDate") => void;
}

const containerClass =
  "rounded-xl border bg-card shadow-sm p-3 md:p-4 flex flex-col gap-3.5";

const motionProps = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  transition: { type: "spring" as const, duration: 0.35, bounce: 0 },
};

export function TransactionFilters(props: TransactionFiltersProps) {
  const { tenant } = useTenant();
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const shouldReduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (!tenant) return;
    WalletService.getWallets(tenant.id)
      .then((data) => setWallets(data.filter((w) => w.status === "active")))
      .catch(console.error);
  }, [tenant]);

  const activeFilterCount = [
    props.searchTerm !== "" ? 1 : 0,
    props.filterType !== "all" ? 1 : 0,
    props.filterStatus.length > 0 ? 1 : 0,
    props.filterWallet !== "" ? 1 : 0,
    (props.filterStartDate ?? "") !== "" ? 1 : 0,
    (props.filterEndDate ?? "") !== "" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAll = () => {
    props.onSearchChange("");
    props.onFilterChange("all");
    props.onStatusChange([]);
    props.onWalletChange("");
    props.onStartDateChange?.("");
    props.onEndDateChange?.("");
  };

  const body = (
    <>
      {/* Linha 1 — Discovery & meta-ações: busca + limpar + modo de visualização */}
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <Input
          className="flex-1 min-w-[240px]"
          placeholder="Buscar por descrição, cliente ou categoria..."
          value={props.searchTerm}
          onChange={(e) => props.onSearchChange(e.target.value)}
          icon={<Search className="w-4 h-4" />}
          suffix={
            <AnimatePresence>
              {props.searchTerm && (
                <motion.button
                  key="clear-search"
                  type="button"
                  onClick={() => props.onSearchChange("")}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.18 }}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              )}
            </AnimatePresence>
          }
        />

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <FilterClearButton
            active={hasActiveFilters}
            count={activeFilterCount}
            onClear={clearAll}
          />
          {props.onViewModeChange && props.viewMode !== undefined && (
            <FilterSegmented
              id="view-mode"
              value={props.viewMode}
              onChange={(v) => props.onViewModeChange?.(v as "grouped" | "byDueDate")}
              options={[
                {
                  value: "byDueDate",
                  label: "Lista",
                  icon: <ListOrdered className="w-3.5 h-3.5" />,
                },
                {
                  value: "grouped",
                  label: "Agrupados",
                  icon: <Layers className="w-3.5 h-3.5" />,
                },
              ]}
            />
          )}
        </div>
      </div>

      {/* Linha 2 — Classificação: tipo + status */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterSegmented
          id="tx-type"
          value={props.filterType}
          onChange={(v) => props.onFilterChange(v as TransactionType | "all")}
          options={[
            { value: "all", label: "Todos" },
            {
              value: "income",
              label: "Receitas",
              icon: <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500" />,
            },
            {
              value: "expense",
              label: "Despesas",
              icon: <ArrowDownCircle className="w-3.5 h-3.5 text-rose-500" />,
            },
          ]}
        />
        <FilterStatusPills value={props.filterStatus} onChange={props.onStatusChange} />
      </div>

      {/* Linha 3 — Refinamento: carteira + período + ordenação */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={props.filterWallet}
          onChange={(e) => props.onWalletChange(e.target.value)}
          inputSize="sm"
          className="w-44 shrink-0"
        >
          <option value="">Todas as carteiras</option>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>

        <FilterPeriod
          dateType={props.filterDateType ?? "dueDate"}
          onDateTypeChange={(v) => props.onDateTypeChange?.(v)}
          startDate={props.filterStartDate ?? ""}
          onStartDateChange={(v) => props.onStartDateChange?.(v)}
          endDate={props.filterEndDate ?? ""}
          onEndDateChange={(v) => props.onEndDateChange?.(v)}
        />

        {props.onSortChange && (
          <Select
            value={props.sortBy ?? "created"}
            onChange={(e) =>
              props.onSortChange?.(e.target.value as "date" | "created")
            }
            inputSize="sm"
            className="w-44 shrink-0 ml-auto"
            disableSort
          >
            <option value="created">Mais recentes</option>
            <option value="date">Por data</option>
          </Select>
        )}
      </div>
    </>
  );

  if (shouldReduceMotion) {
    return <div className={containerClass}>{body}</div>;
  }

  return (
    <motion.div {...motionProps} className={containerClass}>
      {body}
    </motion.div>
  );
}
