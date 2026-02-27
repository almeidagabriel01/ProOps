"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { Plus, Wallet as WalletIcon } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { WalletsSkeleton, WalletFilters } from "./_components";
import { useWalletsCtrl } from "./_hooks/use-wallets-ctrl";
import { useTenant } from "@/providers/tenant-provider";
import { useAuth } from "@/providers/auth-provider";
import { SelectTenantState } from "@/components/shared/select-tenant-state";
import { WalletsSummaryCards } from "./_components/wallets-summary-cards";
import { WalletsGrid, WalletsGridSkeleton } from "./_components/wallets-grid";
import { WalletsDialogs } from "./_components/wallets-dialogs";
import {
  WalletsEmptyState,
  WalletsNoResults,
} from "./_components/wallets-empty-states";

export default function WalletsPage() {
  const { tenant, isLoading: tenantLoading } = useTenant();
  const { user } = useAuth();
  const { state, actions } = useWalletsCtrl();

  const {
    hasFinancial,
    showSkeleton,
    summary,
    wallets,
    filteredWallets,
    activeWallets,
    canCreate,
    canEdit,
    canDelete,
    searchTerm,
    filterType,
    filterStatus,
    // States needed for loading checks or specific UI logic
    isTransferring,
    settingDefaultId,
  } = state;

  // Show loading first - before checking plan access to avoid flash
  if (tenantLoading) {
    return (
      <>
        <WalletsSkeleton />
        <WalletsDialogs state={state} actions={actions} wallets={wallets} />
      </>
    );
  }

  if (!tenant && user?.role === "superadmin") {
    return (
      <>
        <SelectTenantState />
        <WalletsDialogs state={state} actions={actions} wallets={wallets} />
      </>
    );
  }

  if (showSkeleton && !isTransferring && settingDefaultId === null) {
    // Note: isTransferring and settingDefaultId are technically 'loading' states but we might want to show the UI with a spinner instead of a full skeleton.
    // However, the original code used `showSkeleton` for all these.
    // Let's stick to the original behavior or slightly improved:
    // If it's initial load -> Skeleton. If it's an action -> maybe invalidating UI or overlays.
    // The original code returned Skeleton if `showSkeleton` was true.
    return (
      <>
        <WalletsSkeleton />
        <WalletsDialogs state={state} actions={actions} wallets={wallets} />
      </>
    );
  }

  // Check plan access after loading is complete
  if (!hasFinancial) {
    return (
      <>
        <UpgradeRequired
          feature="Carteiras"
          description="O módulo de Carteiras permite gerenciar suas contas bancárias, dinheiro em espécie e carteiras digitais. Faça upgrade para o plano Profissional ou adquira o módulo Financeiro para acessar."
        />
        <WalletsDialogs state={state} actions={actions} wallets={wallets} />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6 flex flex-col min-h-[calc(100vh_-_180px)]">
        {/* Header with Total Balance */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Carteiras</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas contas e carteiras financeiras
            </p>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <div className="text-center md:text-right">
              <div className="flex items-center gap-2 text-muted-foreground mb-1 justify-center md:justify-center">
                <WalletIcon className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Saldo Total
                </span>
              </div>
              <div
                className={`text-2xl font-bold ${
                  summary.totalBalance >= 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {formatCurrency(summary.totalBalance)}
              </div>
            </div>

            {canCreate && (
              <Button
                size="lg"
                className="gap-2"
                onClick={actions.handleCreateWallet}
              >
                <Plus className="w-5 h-5" />
                Nova Carteira
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <WalletsSummaryCards
          summary={summary}
          activeWallets={activeWallets}
          onOpenTransfer={actions.handleOpenTransfer}
        />

        {/* Filters */}
        <WalletFilters
          searchTerm={searchTerm}
          onSearchChange={actions.setSearchTerm}
          filterType={filterType}
          onTypeChange={actions.setFilterType}
          filterStatus={filterStatus}
          onStatusChange={actions.setFilterStatus}
        />

        {/* Wallets Grid */}
        {showSkeleton ? (
          <WalletsGridSkeleton />
        ) : wallets.length === 0 ? (
          <WalletsEmptyState
            canCreate={canCreate}
            onCreate={actions.handleCreateWallet}
          />
        ) : filteredWallets.length === 0 ? (
          <WalletsNoResults />
        ) : (
          <WalletsGrid
            filteredWallets={filteredWallets}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={actions.handleEditWallet}
            onDelete={actions.handleOpenDelete}
            onTransfer={actions.handleOpenTransfer}
            onAdjust={actions.handleOpenAdjust}
            onArchive={actions.handleOpenArchive}
            onSetDefault={actions.handleSetDefault}
            onViewHistory={actions.handleViewHistory}
          />
        )}
      </div>
      <WalletsDialogs state={state} actions={actions} wallets={wallets} />
    </>
  );
}
