import { Wallet } from "@/types";
import {
  WalletFormDialog,
  TransferDialog,
  AdjustBalanceDialog,
  DeleteWalletDialog,
  ArchiveWalletDialog,
  WalletHistoryDialog,
} from ".";
import { useWalletsCtrl } from "../_hooks/use-wallets-ctrl";

// We extract props from the controller state/actions
interface WalletsDialogsProps {
  state: ReturnType<typeof useWalletsCtrl>["state"];
  actions: ReturnType<typeof useWalletsCtrl>["actions"];
  wallets: Wallet[];
}

export function WalletsDialogs({
  state,
  actions,
  wallets,
}: WalletsDialogsProps) {
  const {
    formDialogOpen,
    selectedWallet,
    transferDialogOpen,
    adjustDialogOpen,
    deleteDialogOpen,
    isDeleting,
    archiveDialogOpen,
    isArchiving,
    walletForHistory,
    historyDialogOpen,
  } = state;

  const {
    setFormDialogOpen,
    handleFormSubmit,
    setTransferDialogOpen,
    handleTransferSubmit,
    setAdjustDialogOpen,
    handleAdjustSubmit,
    setDeleteDialogOpen,
    handleConfirmDelete,
    setArchiveDialogOpen,
    handleConfirmArchive,
    setHistoryDialogOpen,
  } = actions;

  return (
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
}
