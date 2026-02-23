import * as React from "react";
import { usePagePermission } from "@/hooks/usePagePermission";
import { useTenant } from "@/providers/tenant-provider";
import { Wallet, WalletType } from "@/types";
import { normalize } from "@/utils/text";
import {
  CreateWalletInput,
  UpdateWalletInput,
} from "@/services/wallet-service";
import { useWalletsData } from "./useWalletsData";

export function useWalletsCtrl() {
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
    null
  );
  
  // Async action states
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [settingDefaultId, setSettingDefaultId] = React.useState<string | null>(
    null
  );
  
  // History dialog
  const [historyDialogOpen, setHistoryDialogOpen] = React.useState(false);
  const [walletForHistory, setWalletForHistory] = React.useState<Wallet | null>(
    null
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
      const term = normalize(searchTerm);
      filtered = filtered.filter(
        (w) =>
          normalize(w.name).includes(term) ||
          normalize(w.description || "").includes(term)
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
    data: CreateWalletInput | UpdateWalletInput
  ) => {
    if (selectedWallet) {
      return await updateWallet(selectedWallet.id, data as UpdateWalletInput);
    }
    const result = await createWallet(data as CreateWalletInput);
    return result !== null;
  };

  const handleTransferSubmit = async (
    data: Parameters<typeof transferBalance>[0]
  ) => {
    setIsTransferring(true);
    const result = await transferBalance(data);
    setIsTransferring(false);
    return result;
  };

  const handleAdjustSubmit = async (
    walletId: string,
    data: Parameters<typeof adjustBalance>[1]
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
  
  const handleViewHistory = (wallet: Wallet) => {
    setWalletForHistory(wallet);
    setHistoryDialogOpen(true);
  };
  
  const activeWallets = wallets.filter((w) => w.status === "active");

  return {
    state: {
      hasFinancial,
      showSkeleton,
      summary,
      wallets,
      filteredWallets,
      activeWallets,
      canCreate,
      canEdit,
      canDelete,
      
      // Dialog states
      formDialogOpen,
      transferDialogOpen,
      adjustDialogOpen,
      deleteDialogOpen,
      archiveDialogOpen,
      selectedWallet,
      historyDialogOpen,
      walletForHistory,

      // Async states
      isDeleting,
      isArchiving,
      isTransferring,
      settingDefaultId,

      // Filter states
      searchTerm,
      filterType,
      filterStatus,
    },
    actions: {
      setFormDialogOpen,
      setTransferDialogOpen,
      setAdjustDialogOpen,
      setDeleteDialogOpen,
      setArchiveDialogOpen,
      setHistoryDialogOpen,
      setSearchTerm,
      setFilterType,
      setFilterStatus,
      
      handleCreateWallet,
      handleEditWallet,
      handleOpenTransfer,
      handleOpenAdjust,
      handleOpenDelete,
      handleOpenArchive,
      handleFormSubmit,
      handleTransferSubmit,
      handleAdjustSubmit,
      handleConfirmDelete,
      handleConfirmArchive,
      handleSetDefault,
      handleViewHistory,
    }
  };
}
