"use client";

import { useState } from "react";
import { Proposal } from "@/services/proposal-service";
import { ProposalTemplate, Tenant } from "@/types";
import { toast } from '@/lib/toast';
import { savePdfBlob } from "@/services/pdf/render-to-pdf";
import {
  generateProposalPdf,
  ProposalPdfCustomSettings,
} from "@/services/pdf/generate-proposal-pdf";

type PdfViewerSettings = ProposalPdfCustomSettings;

interface UsePdfGeneratorProps {
  proposal: Partial<Proposal>;
  template?: ProposalTemplate | null;
  tenant?: Tenant | null;
  customSettings?: PdfViewerSettings;
  showCover?: boolean;
  setIsOpen: (open: boolean) => void;
}

export function usePdfGenerator({
  proposal,
  template,
  tenant,
  customSettings,
  showCover = true,
  setIsOpen,
}: UsePdfGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (
    rootElementId?: string,
    sourceLabel: "download" | "view" | "edit-preview" | "shared" = "download",
  ) => {
    setIsGenerating(true);
    try {
      const hasProposalPayload = Boolean(
        proposal &&
          (proposal.id ||
            (proposal.products && proposal.products.length > 0) ||
            proposal.title),
      );

      if (!hasProposalPayload) {
        toast.error("Erro ao localizar dados da proposta para gerar o PDF.");
        return;
      }

      const result = await generateProposalPdf({
        proposal,
        template,
        tenant,
        customSettings,
        showCover,
        rootHint: rootElementId || "pdf-offscreen-content",
        proposalTitle: proposal?.title,
        tenantId: proposal?.tenantId,
        sourceLabel,
      });

      savePdfBlob(result.blob, result.filename);
      setIsOpen(false);
      toast.success("PDF baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF.");
      setIsOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return { isGenerating, handleGenerate };
}
