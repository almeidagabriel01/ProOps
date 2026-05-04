"use client";

import { useState } from "react";
import { Transaction } from "@/services/transaction-service";
import { Tenant } from "@/types";
import { toast } from "@/lib/toast";
import { downloadTransactionPdfFromBackend } from "@/services/pdf/download-transaction-pdf";

interface UseTransactionPdfGeneratorProps {
  transaction: Transaction;
  relatedTransactions?: Transaction[];
  tenant?: Tenant | null;
}

/**
 * Hook centralizado para download de PDF de recibo de lançamento financeiro.
 *
 * SEGURANÇA: usa endpoint autenticado (Bearer token) GET /v1/transactions/:id/pdf.
 * Não cria mais share links públicos de 30 dias só para o download privado,
 * evitando a mistura de "download privado" com "compartilhamento público".
 */
export function useTransactionPdfGenerator({
  transaction,
  tenant: _tenant,
}: UseTransactionPdfGeneratorProps) {
  void _tenant;
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (
    _rootElementId?: string,
    _sourceLabel: "download" | "view" | "edit-preview" | "shared" = "download",
  ) => {
    void _rootElementId;
    void _sourceLabel;

    setIsGenerating(true);
    try {
      if (!transaction?.id) {
        toast.error("Erro ao localizar dados do lancamento para gerar o PDF.");
        return;
      }

      await downloadTransactionPdfFromBackend(transaction.id, transaction.description);
      toast.success("PDF baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  return { isGenerating, handleGenerate };
}

