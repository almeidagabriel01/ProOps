"use client";

import * as React from "react";
import { TransactionService, type Transaction } from "@/services/transaction-service";
import { WalletService } from "@/services/wallet-service";

/**
 * O que o fluxo projetado precisa: o saldo das carteiras ativas e os
 * lançamentos em aberto. Lido direto do Firestore, como o Dashboard faz, o que
 * também funciona na demonstração (o tenant `demo` é legível pelas rules).
 */
export function useCashFlowData(tenantId: string | undefined, enabled: boolean) {
  const [items, setItems] = React.useState<Transaction[]>([]);
  const [startingBalance, setStartingBalance] = React.useState(0);
  const [walletCount, setWalletCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tenantId || !enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([TransactionService.getOpenTransactions(tenantId), WalletService.getWallets(tenantId)])
      .then(([open, wallets]) => {
        if (cancelled) return;
        const active = wallets.filter((w) => w.status === "active");
        setItems(open);
        setWalletCount(active.length);
        setStartingBalance(active.reduce((sum, w) => sum + (Number(w.balance) || 0), 0));
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar os lançamentos agora.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, enabled]);

  return { items, startingBalance, walletCount, loading, error };
}
