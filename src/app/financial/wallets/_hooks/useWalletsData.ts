"use client";

import * as React from "react";
import { toast } from "react-toastify";
import { Wallet, WalletTransaction } from "@/types";
import {
  WalletService,
  WalletSummary,
  CreateWalletInput,
  UpdateWalletInput,
  TransferInput,
  AdjustBalanceInput,
} from "@/services/wallet-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface UseWalletsDataReturn {
  wallets: Wallet[];
  summary: WalletSummary;
  isLoading: boolean;
  hasFinancial: boolean;
  isPlanLoading: boolean;
  // Actions
  createWallet: (data: CreateWalletInput) => Promise<string | null>;
  updateWallet: (walletId: string, data: UpdateWalletInput) => Promise<boolean>;
  deleteWallet: (walletId: string, force?: boolean) => Promise<boolean>;
  transferBalance: (data: TransferInput) => Promise<boolean>;
  adjustBalance: (
    walletId: string,
    data: AdjustBalanceInput
  ) => Promise<boolean>;
  setWalletAsDefault: (walletId: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  getWalletTransactions: (walletId: string) => Promise<WalletTransaction[]>;
}

export function useWalletsData(): UseWalletsDataReturn {
  const { tenant } = useTenant();
  const { hasFinancial, isLoading: isPlanLoading } = usePlanLimits();
  const [wallets, setWallets] = React.useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<WalletSummary>({
    totalBalance: 0,
    walletCount: 0,
    activeWallets: 0,
  });

  const fetchData = React.useCallback(async () => {
    if (!tenant || (!hasFinancial && !isPlanLoading)) return;

    setIsLoading(true);
    try {
      const [walletsData, summaryData] = await Promise.all([
        WalletService.getWallets(tenant.id),
        WalletService.getSummary(tenant.id),
      ]);
      setWallets(walletsData);
      setSummary(summaryData);
    } catch (error) {
      console.error("Failed to fetch wallets", error);
    } finally {
      setIsLoading(false);
    }
  }, [tenant, hasFinancial, isPlanLoading]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createWallet = React.useCallback(
    async (data: CreateWalletInput): Promise<string | null> => {
      try {
        const result = await WalletService.createWallet(data);
        await fetchData(); // Refresh data
        toast.success("Carteira criada com sucesso!");
        return result.walletId;
      } catch (error: unknown) {
        console.error("Error creating wallet:", error);
        const message =
          error instanceof Error ? error.message : "Erro ao criar carteira";
        toast.error(message);
        return null;
      }
    },
    [fetchData]
  );

  const updateWallet = React.useCallback(
    async (walletId: string, data: UpdateWalletInput): Promise<boolean> => {
      try {
        await WalletService.updateWallet(walletId, data);
        await fetchData(); // Refresh data
        toast.success("Carteira atualizada com sucesso!");
        return true;
      } catch (error: unknown) {
        console.error("Error updating wallet:", error);
        const message =
          error instanceof Error ? error.message : "Erro ao atualizar carteira";
        toast.error(message);
        return false;
      }
    },
    [fetchData]
  );

  const deleteWallet = React.useCallback(
    async (walletId: string, force = false): Promise<boolean> => {
      try {
        await WalletService.deleteWallet(walletId, force);
        await fetchData(); // Refresh data
        toast.success("Carteira excluída com sucesso!");
        return true;
      } catch (error: unknown) {
        console.error("Error deleting wallet:", error);
        const message =
          error instanceof Error ? error.message : "Erro ao excluir carteira";
        toast.error(message);
        return false;
      }
    },
    [fetchData]
  );

  const transferBalance = React.useCallback(
    async (data: TransferInput): Promise<boolean> => {
      try {
        await WalletService.transferBalance(data);
        await fetchData(); // Refresh data
        toast.success("Transferência realizada com sucesso!");
        return true;
      } catch (error: unknown) {
        console.error("Error transferring balance:", error);
        const message =
          error instanceof Error ? error.message : "Erro ao transferir saldo";
        toast.error(message);
        return false;
      }
    },
    [fetchData]
  );

  const adjustBalance = React.useCallback(
    async (walletId: string, data: AdjustBalanceInput): Promise<boolean> => {
      try {
        await WalletService.adjustBalance(walletId, data);
        await fetchData(); // Refresh data
        toast.success(
          data.amount > 0
            ? "Saldo adicionado com sucesso!"
            : "Saldo removido com sucesso!"
        );
        return true;
      } catch (error: unknown) {
        console.error("Error adjusting balance:", error);
        const message =
          error instanceof Error ? error.message : "Erro ao ajustar saldo";
        toast.error(message);
        return false;
      }
    },
    [fetchData]
  );

  const getWalletTransactions = React.useCallback(
    async (walletId: string): Promise<WalletTransaction[]> => {
      try {
        return await WalletService.getWalletTransactions(walletId);
      } catch (error) {
        console.error("Error fetching wallet transactions:", error);
        toast.error("Erro ao carregar movimentações");
        return [];
      }
    },
    []
  );

  const setWalletAsDefault = React.useCallback(
    async (walletId: string): Promise<boolean> => {
      try {
        // Clear any existing default wallet
        const currentDefault = wallets.find((w) => w.isDefault);
        if (currentDefault && currentDefault.id !== walletId) {
          await WalletService.updateWallet(currentDefault.id, {
            isDefault: false,
          });
        }

        // Set the new wallet as default
        await WalletService.updateWallet(walletId, { isDefault: true });
        await fetchData(); // Refresh data
        toast.success("Carteira padrão definida com sucesso!");
        return true;
      } catch (error: unknown) {
        console.error("Error setting default wallet:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Erro ao definir carteira padrão";
        toast.error(message);
        return false;
      }
    },
    [fetchData, wallets]
  );

  return {
    wallets,
    summary,
    isLoading,
    hasFinancial,
    isPlanLoading,
    createWallet,
    updateWallet,
    deleteWallet,
    transferBalance,
    adjustBalance,
    setWalletAsDefault,
    refreshData: fetchData,
    getWalletTransactions,
  };
}
