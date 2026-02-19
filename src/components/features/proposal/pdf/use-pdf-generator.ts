"use client";

import { useState } from "react";
import { Proposal } from "@/services/proposal-service";
import { ProposalTemplate, Tenant } from "@/types";
import { CoverElement, PdfSection } from "@/components/features/proposal/pdf-section-editor";
import { ThemeType } from "@/components/features/proposal/edit-pdf/pdf-theme-utils";
import { toast } from "react-toastify";
import { renderToPdf, savePdfBlob } from "@/services/pdf/render-to-pdf";
import { renderProposalToPdfOffscreen } from "@/services/pdf/render-proposal-offscreen";

interface PdfViewerSettings {
  theme?: ThemeType;
  primaryColor?: string;
  fontFamily?: string;
  coverTitle?: string;
  coverImage?: string;
  coverLogo?: string;
  coverImageOpacity?: number;
  coverImageFit?: "cover" | "contain";
  coverImagePosition?: string;
  sections?: PdfSection[];
  coverElements?: CoverElement[];
  repeatHeader?: boolean;
  pageNumberStart?: number;
  logoStyle?: "original" | "rounded" | "circle";
}

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
      let result = null;

      if (proposal?.id && tenant) {
        result = await renderProposalToPdfOffscreen({
          proposal: proposal as Proposal,
          template,
          tenant,
          customSettings,
          showCover,
          rootHint: rootElementId || "pdf-offscreen-content",
          proposalTitle: proposal?.title,
          tenantId: proposal?.tenantId,
          sourceLabel,
        });
      } else {
        const sourceRoot = rootElementId
          ? document.getElementById(rootElementId)
          : document.body;

        if (!sourceRoot) {
          toast.error("Erro ao localizar conteudo para gerar o PDF.");
          return;
        }

        result = await renderToPdf({
          rootElement: sourceRoot,
          rootHint: rootElementId || "document.body",
          proposalTitle: proposal?.title,
          tenantId: proposal?.tenantId,
          sourceLabel,
        });
      }

      if (!result) return;

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
