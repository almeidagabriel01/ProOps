"use client";

import * as React from "react";
import { WalletService } from "@/services/wallet-service";
import { walletLabel } from "@/lib/wallet-label";
import type { Wallet } from "@/types";

/**
 * O nome da carteira para uma tela que só tem o lançamento em mãos. Enquanto
 * as carteiras carregam (ou se falharem) mostra o valor gravado.
 */
export function useWalletLabel(tenantId: string | null | undefined, value: string | null | undefined): string {
  const [wallets, setWallets] = React.useState<Wallet[]>([]);

  React.useEffect(() => {
    if (!tenantId || !value) return;
    let cancelled = false;
    WalletService.getWallets(tenantId)
      .then((list) => !cancelled && setWallets(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tenantId, value]);

  return walletLabel(value, wallets);
}
