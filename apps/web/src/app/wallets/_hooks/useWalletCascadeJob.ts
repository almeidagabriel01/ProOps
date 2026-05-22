"use client";

import { useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast, type Id } from "@/lib/toast";

export interface WalletCascadeJobSnapshot {
  status: "pending" | "running" | "completed" | "failed";
  progress: { transactionsUpdated: number; proposalsUpdated: number };
  error?: string;
}

interface UseWalletCascadeJobArgs {
  jobId: string | null;
  onSettled?: () => void; // called when job completes or fails — useful to re-fetch
}

/**
 * Subscribes to a wallet_cascade_jobs/{jobId} document and surfaces its
 * lifecycle to the user as toast notifications:
 *   - initial: "Sincronizando lançamentos e propostas…"
 *   - completed: success toast with totals
 *   - failed: error toast with reason
 *
 * Returns nothing — purely a side-effect hook. The listener auto-detaches
 * when the job settles, when jobId becomes null, or when the consumer
 * unmounts.
 */
export function useWalletCascadeJob({ jobId, onSettled }: UseWalletCascadeJobArgs) {
  const initialToastIdRef = useRef<Id | null>(null);

  useEffect(() => {
    if (!jobId) return;

    initialToastIdRef.current = toast.info(
      "Sincronizando lançamentos e propostas com o novo nome…",
    ) as Id;

    const unsubscribe = onSnapshot(
      doc(db, "wallet_cascade_jobs", jobId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as WalletCascadeJobSnapshot;

        if (data.status === "completed") {
          if (initialToastIdRef.current != null) {
            toast.dismiss(initialToastIdRef.current);
            initialToastIdRef.current = null;
          }
          const { transactionsUpdated, proposalsUpdated } = data.progress;
          const parts: string[] = [];
          if (transactionsUpdated > 0) {
            parts.push(
              `${transactionsUpdated} lançamento${transactionsUpdated === 1 ? "" : "s"}`,
            );
          }
          if (proposalsUpdated > 0) {
            parts.push(
              `${proposalsUpdated} proposta${proposalsUpdated === 1 ? "" : "s"}`,
            );
          }
          const message =
            parts.length > 0
              ? `Sincronização concluída: ${parts.join(" e ")} atualizado${transactionsUpdated + proposalsUpdated === 1 ? "" : "s"} com o novo nome.`
              : "Nada para sincronizar — todas as referências já estavam atualizadas.";
          toast.success(message);
          onSettled?.();
          unsubscribe();
          return;
        }

        if (data.status === "failed") {
          if (initialToastIdRef.current != null) {
            toast.dismiss(initialToastIdRef.current);
            initialToastIdRef.current = null;
          }
          const message = `Erro ao sincronizar lançamentos com o novo nome${data.error ? `: ${data.error}` : ""}.`;
          toast.error(message);
          onSettled?.();
          unsubscribe();
        }
      },
      (error) => {
        console.error("wallet_cascade_job listener error", error);
        if (initialToastIdRef.current != null) {
          toast.dismiss(initialToastIdRef.current);
          initialToastIdRef.current = null;
        }
        toast.error("Erro ao acompanhar sincronização da carteira.");
        onSettled?.();
      },
    );

    return () => {
      unsubscribe();
      if (initialToastIdRef.current != null) {
        toast.dismiss(initialToastIdRef.current);
        initialToastIdRef.current = null;
      }
    };
  }, [jobId, onSettled]);
}
