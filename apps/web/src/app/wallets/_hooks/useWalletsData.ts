"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from '@/lib/toast';
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
    data: AdjustBalanceInput,
  ) => Promise<boolean>;
  setWalletAsDefault: (walletId: string) => Promise<boolean>;
  refreshData: () => Promise<void>;
  getWalletTransactions: (walletId: string) => Promise<WalletTransaction[]>;
}

export function useWalletsData(): UseWalletsDataReturn {
  const { tenant } = useTenant();
  const { hasFinancial, isLoading: isPlanLoading } = usePlanLimits();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<WalletSummary>({
    totalBalance: 0,
    walletCount: 0,
    activeWallets: 0,
  });

  // Track if we have already loaded data once to avoid flickering
  const hasLoadedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!tenant) {
      setWallets([]);
      setSummary({
        totalBalance: 0,
        walletCount: 0,
        activeWallets: 0,
      });
      setIsLoading(false);
      return;
    }

    if (!hasFinancial && !isPlanLoading) {
      setIsLoading(false);
      return;
    }

    // Only show loading state if we haven't loaded data yet
    // This prevents the flickering when navigating back or when deps change
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }

    try {
      const [walletsData, summaryData] = await Promise.all([
        WalletService.getWallets(tenant.id),
        WalletService.getSummary(tenant.id),
      ]);
      setWallets(walletsData);
      setSummary(summaryData);
      hasLoadedRef.current = true;
    } catch (error) {
      console.error("Failed to fetch wallets", error);
      toast.error(
        "Não foi possível carregar as carteiras. Verifique sua conexão e tente novamente.",
        { title: "Erro ao carregar" },
      );
    } finally {
      setIsLoading(false);
    }
  }, [tenant, hasFinancial, isPlanLoading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createWallet = useCallback(
    async (data: CreateWalletInput): Promise<string | null> => {
      try {
        const result = await WalletService.createWallet({
          ...data,
          targetTenantId: tenant?.id, // Pass tenant ID for super admin support
        });
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
    [fetchData, tenant?.id],
  );

  const updateWallet = useCallback(
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
    [fetchData],
  );

  const deleteWallet = useCallback(
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
    [fetchData],
  );

  const transferBalance = useCallback(
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
    [fetchData],
  );

  const adjustBalance = useCallback(
    async (walletId: string, data: AdjustBalanceInput): Promise<boolean> => {
      try {
        await WalletService.adjustBalance(walletId, data);
        await fetchData(); // Refresh data
        toast.success(
          data.amount > 0
            ? "Saldo adicionado com sucesso!"
            : "Saldo removido com sucesso!",
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
    [fetchData],
  );

  const getWalletTransactions = useCallback(
    async (walletId: string): Promise<WalletTransaction[]> => {
      if (!tenant?.id) return [];
      try {
        return await WalletService.getWalletTransactions(walletId, tenant.id);
      } catch (error) {
        console.error("Error fetching wallet transactions:", error);
        toast.error("Erro ao carregar movimentações");
        return [];
      }
    },
    [tenant?.id],
  );

  const setWalletAsDefault = useCallback(
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
    [fetchData, wallets],
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
