"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UpgradeRequired } from "@/components/ui/upgrade-required";
import { usePagePermission } from "@/hooks/usePagePermission";
import { Wallet } from "@/types";
import {
  CreateWalletInput,
  UpdateWalletInput,
} from "@/services/wallet-service";
import {
  Plus,
  Wallet as WalletIcon,
  ArrowRightLeft,
  TrendingUp,
  Layers,
} from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { useWalletsData } from "./_hooks/useWalletsData";
import { useTenant } from "@/providers/tenant-provider";
import {
  WalletCard,
  WalletFormDialog,
  TransferDialog,
  AdjustBalanceDialog,
  DeleteWalletDialog,
  ArchiveWalletDialog,
  WalletsSkeleton,
  WalletFilters,
  WalletHistoryDialog,
} from "./_components";
import { WalletType } from "@/types";

export default function WalletsPage() {
  const { isLoading: tenantLoading } = useTenant();
  const { canCreate, canEdit, canDelete } = usePagePermission("financial");
  const {
    wallets,
    summary,
    isLoading: dataLoading,
    hasFinancial,
    isPlanLoading,
    createWallet,
    updateWallet,
    deleteWallet,
    transferBalance,
    adjustBalance,
    setWalletAsDefault,
  } = useWalletsData();

  const isLoading = tenantLoading || dataLoading;

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false);
  const [selectedWallet, setSelectedWallet] = React.useState<Wallet | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [settingDefaultId, setSettingDefaultId] = React.useState<string | null>(
    null,
  );
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);
  const [walletForHistory, setWalletForHistory] = React.useState<Wallet | null>(
    null,
  );

  // Filter states
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<WalletType | "all">("all");
  const [filterStatus, setFilterStatus] = React.useState<
    "active" | "archived" | "all"
  >("active");

  // Filtered wallets
  const filteredWallets = React.useMemo(() => {
    let filtered = wallets;

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((w) => w.status === filterStatus);
    }

    // Filter by type
    if (filterType !== "all") {
      filtered = filtered.filter((w) => w.type === filterType);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.name.toLowerCase().includes(term) ||
          w.description?.toLowerCase().includes(term),
      );
    }

    return filtered;
  }, [wallets, searchTerm, filterType, filterStatus]);

  // Include isPlanLoading in isLoading to show skeleton while loading plan data
  const showSkeleton =
    isLoading || isPlanLoading || isTransferring || settingDefaultId !== null;

  // Handlers
  const handleCreateWallet = () => {
    setSelectedWallet(null);
    setFormDialogOpen(true);
  };

  const handleEditWallet = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setFormDialogOpen(true);
  };

  const handleOpenTransfer = (wallet?: Wallet) => {
    setSelectedWallet(wallet || null);
    setTransferDialogOpen(true);
  };

  const handleOpenAdjust = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setAdjustDialogOpen(true);
  };

  const handleOpenDelete = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (
    data: CreateWalletInput | UpdateWalletInput,
  ) => {
    if (selectedWallet) {
      return await updateWallet(selectedWallet.id, data as UpdateWalletInput);
    }
    const result = await createWallet(data as CreateWalletInput);
    return result !== null;
  };

  const handleTransferSubmit = async (
    data: Parameters<typeof transferBalance>[0],
  ) => {
    setIsTransferring(true);
    const result = await transferBalance(data);
    setIsTransferring(false);
    return result;
  };

  const handleAdjustSubmit = async (
    walletId: string,
    data: Parameters<typeof adjustBalance>[1],
  ) => {
    return await adjustBalance(walletId, data);
  };

  const handleConfirmDelete = async (force: boolean) => {
    if (!selectedWallet) return;

    setIsDeleting(true);
    await deleteWallet(selectedWallet.id, force);
    setIsDeleting(false);
    setDeleteDialogOpen(false);
    setSelectedWallet(null);
  };

  const handleOpenArchive = (wallet: Wallet) => {
    setSelectedWallet(wallet);
    setArchiveDialogOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!selectedWallet) return;

    setIsArchiving(true);
    const newStatus =
      selectedWallet.status === "archived" ? "active" : "archived";
    await updateWallet(selectedWallet.id, { status: newStatus });
    setIsArchiving(false);
    setArchiveDialogOpen(false);
    setSelectedWallet(null);
  };

  const handleSetDefault = async (wallet: Wallet) => {
    setSettingDefaultId(wallet.id);
    await setWalletAsDefault(wallet.id);
    setSettingDefaultId(null);
  };

  const activeWallets = wallets.filter((w) => w.status === "active");

  // Dialogs component to ensure stability
  const renderDialogs = () => (
    <>
      <WalletFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        wallet={selectedWallet}
        onSubmit={handleFormSubmit}
      />

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        wallets={wallets}
        selectedWallet={selectedWallet}
        onSubmit={handleTransferSubmit}
      />

      <AdjustBalanceDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        wallet={selectedWallet}
        onSubmit={handleAdjustSubmit}
      />

      <DeleteWalletDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        wallet={selectedWallet}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      <ArchiveWalletDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        wallet={selectedWallet}
        isLoading={isArchiving}
        onConfirm={handleConfirmArchive}
      />

      <WalletHistoryDialog
        wallet={walletForHistory}
        open={historyDialogOpen}
        onOpenChange={setHistoryDialogOpen}
      />
    </>
  );

  // Show loading first - before checking plan access to avoid flash
  if (showSkeleton) {
    return (
      <>
        <WalletsSkeleton />
        {renderDialogs()}
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
        {renderDialogs()}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
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
              <Button size="lg" className="gap-2" onClick={handleCreateWallet}>
                <Plus className="w-5 h-5" />
                Nova Carteira
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Carteiras Ativas
                  </p>
                  <p className="text-2xl font-bold">{summary.activeWallets}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Saldo Consolidado
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.totalBalance)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Transferências
                  </p>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-lg font-semibold"
                    onClick={() => handleOpenTransfer()}
                    disabled={activeWallets.length < 2}
                  >
                    Transferir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <WalletFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterType={filterType}
          onTypeChange={setFilterType}
          filterStatus={filterStatus}
          onStatusChange={setFilterStatus}
        />

        {/* Wallets Grid */}
        {wallets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <WalletIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Nenhuma carteira cadastrada
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                Comece criando sua primeira carteira para gerenciar seu
                dinheiro.
              </p>
              {canCreate && (
                <Button className="gap-2" onClick={handleCreateWallet}>
                  <Plus className="w-4 h-4" />
                  Criar Primeira Carteira
                </Button>
              )}
            </CardContent>
          </Card>
        ) : filteredWallets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <WalletIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Nenhum resultado encontrado
              </h3>
              <p className="text-muted-foreground text-center">
                Tente buscar por outro termo ou remova os filtros.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredWallets.map((wallet) => (
              <WalletCard
                key={wallet.id}
                wallet={wallet}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={handleEditWallet}
                onDelete={handleOpenDelete}
                onTransfer={handleOpenTransfer}
                onAdjust={handleOpenAdjust}
                onArchive={handleOpenArchive}
                onSetDefault={handleSetDefault}
                onViewHistory={(wallet) => {
                  setWalletForHistory(wallet);
                  setHistoryDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {renderDialogs()}
    </>
  );
}
