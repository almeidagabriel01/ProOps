"use client";

import * as React from "react";
import type { Transaction } from "@/services/transaction-service";
import type { Wallet } from "@/types";

export function useOptimisticWallets(
  setWallets: React.Dispatch<React.SetStateAction<Wallet[]>>,
) {
  const calculateWalletImpacts = React.useCallback(
    (tx: Partial<Transaction>) => {
      const impacts = new Map<string, number>();
      const addImpact = (
        wallet: string | null | undefined,
        amount: number,
        isIncome: boolean,
      ) => {
        if (!wallet) return;
        const delta = (isIncome ? 1 : -1) * (amount || 0);
        impacts.set(wallet, (impacts.get(wallet) || 0) + delta);
      };

      if (tx?.status === "paid" && tx?.wallet) {
        addImpact(tx.wallet, tx.amount || 0, tx.type === "income");
      }

      if (tx?.extraCosts && Array.isArray(tx.extraCosts)) {
        for (const ec of tx.extraCosts) {
          if (ec.status === "paid" && (ec.wallet || tx.wallet)) {
            // Extra costs add to the value of the parent transaction (so if parent is income, extra cost is income)
            addImpact(
              ec.wallet || tx.wallet,
              ec.amount || 0,
              tx.type === "income",
            );
          }
        }
      }
      return impacts;
    },
    [],
  );

  const applyOptimisticWalletUpdate = React.useCallback(
    (oldTx: Transaction | undefined, newTx: Transaction | undefined) => {
      setWallets((prev) => {
        const oldImpacts = oldTx ? calculateWalletImpacts(oldTx) : new Map();
        const newImpacts = newTx ? calculateWalletImpacts(newTx) : new Map();
        return prev.map((w) => {
          const oldVal = oldImpacts.get(w.name) || oldImpacts.get(w.id) || 0;
          const newVal = newImpacts.get(w.name) || newImpacts.get(w.id) || 0;
          const diff = newVal - oldVal;
          if (diff === 0) return w;
          return { ...w, balance: w.balance + diff };
        });
      });
    },
    [calculateWalletImpacts, setWallets],
  );

  const applyOptimisticWalletUpdateBatch = React.useCallback(
    (updates: { oldTx: Transaction; newTx: Transaction }[]) => {
      setWallets((prev) => {
        const netDeltas = new Map<string, number>();
        updates.forEach(({ oldTx, newTx }) => {
          const oldImpacts = calculateWalletImpacts(oldTx);
          const newImpacts = calculateWalletImpacts(newTx);
          for (const [wId, val] of oldImpacts.entries()) {
            netDeltas.set(wId, (netDeltas.get(wId) || 0) - val);
          }
          for (const [wId, val] of newImpacts.entries()) {
            netDeltas.set(wId, (netDeltas.get(wId) || 0) + val);
          }
        });
        return prev.map((w) => {
          // Use OR (not sum) to avoid double-counting when the same wallet is keyed
          // by both its ID (new data) and its name (legacy data) in the deltas map.
          const diff = netDeltas.get(w.id) ?? netDeltas.get(w.name) ?? 0;
          if (diff === 0) return w;
          return { ...w, balance: w.balance + diff };
        });
      });
    },
    [calculateWalletImpacts, setWallets],
  );

  return {
    calculateWalletImpacts,
    applyOptimisticWalletUpdate,
    applyOptimisticWalletUpdateBatch,
  };
}
