"use client";

import { useCallback, useEffect, useState } from "react";
import { WalletService, type WalletOption } from "@/services/wallet-service";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface UseWalletOptionsReturn {
  wallets: WalletOption[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * As carteiras da empresa para um seletor, sem saldo. Quem monta proposta ou
 * contrato não precisa ver o financeiro para escolher a carteira que recebe.
 */
export function useWalletOptions(): UseWalletOptionsReturn {
  const { tenant } = useTenant();
  const { hasFinancial, isLoading: isPlanLoading } = usePlanLimits();
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tenant?.id || isPlanLoading) return;
    if (!hasFinancial) {
      setWallets([]);
      setIsLoading(false);
      return;
    }
    try {
      setWallets(await WalletService.getWalletOptions());
    } catch (error) {
      console.error("Failed to fetch wallet options", error);
      setWallets([]);
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id, hasFinancial, isPlanLoading]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { wallets, isLoading, refresh };
}
