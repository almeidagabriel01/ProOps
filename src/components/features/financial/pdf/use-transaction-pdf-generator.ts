"use client";

import { useState } from "react";
import { Transaction } from "@/services/transaction-service";
import { Tenant } from "@/types";
import { toast } from "@/lib/toast";
import { SharedTransactionService } from "@/services/shared-transaction-service";
import { downloadSharedTransactionPdf } from "@/services/pdf/download-shared-transaction-pdf";

interface UseTransactionPdfGeneratorProps {
  transaction: Transaction;
  relatedTransactions?: Transaction[];
  tenant?: Tenant | null;
}

export function useTransactionPdfGenerator({
  transaction,
  tenant: _tenant,
}: UseTransactionPdfGeneratorProps) {
  void _tenant;
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (
    rootElementId?: string,
    sourceLabel: "download" | "view" | "edit-preview" | "shared" = "download",
  ) => {
    setIsGenerating(true);
    try {
      const hasTransactionPayload = Boolean(transaction && transaction.id);

      if (!hasTransactionPayload) {
        toast.error("Erro ao localizar dados do lancamento para gerar o PDF.");
        return;
      }

      void rootElementId;
      void sourceLabel;

      const share = await SharedTransactionService.generateShareLink(
        transaction.id,
      );
      await downloadSharedTransactionPdf(share.token, transaction.description);

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
