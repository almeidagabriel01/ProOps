"use client";

import { useState } from "react";
import { Transaction } from "@/services/transaction-service";
import { Tenant } from "@/types";
import { toast } from '@/lib/toast';
import { savePdfBlob, renderToPdf } from "@/services/pdf/render-to-pdf";
import { buildReceiptPdfFilename } from "@/services/pdf/pdf-filename";

interface UseTransactionPdfGeneratorProps {
  transaction: Transaction;
  relatedTransactions?: Transaction[];
  tenant?: Tenant | null;
}

export function useTransactionPdfGenerator({
  transaction,
  tenant,
}: UseTransactionPdfGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (
    rootElementId?: string,
    sourceLabel: "download" | "view" | "edit-preview" | "shared" = "download",
  ) => {
    setIsGenerating(true);
    try {
      const hasTransactionPayload = Boolean(transaction && transaction.id);

      if (!hasTransactionPayload) {
        toast.error("Erro ao localizar dados do lançamento para gerar o PDF.");
        return;
      }

      const targetId = rootElementId || "shared-transaction-preview-content";
      const rootElement = document.getElementById(targetId);

      if (!rootElement) {
        toast.error("Erro ao renderizar o PDF (Elemento não encontrado).");
        return;
      }

      const result = await renderToPdf({
        rootElement,
        rootHint: targetId,
        proposalTitle: `Recibo-${transaction.description}`,
        tenantId: tenant?.id || transaction.tenantId,
        sourceLabel,
      });

      const safeDesc = String(transaction.description || "")
        .replace(/[^a-z0-9]/gi, "_")
        .substring(0, 30);
      const filename = buildReceiptPdfFilename(safeDesc);

      savePdfBlob(result.blob, filename);
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
