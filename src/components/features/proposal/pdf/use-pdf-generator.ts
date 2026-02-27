"use client";

import { useCallback, useState } from "react";
import { Proposal } from "@/services/proposal-service";
import { ProposalTemplate, Tenant } from "@/types";
import { toast } from "@/lib/toast";
import { downloadProposalPdfFromBackend } from "@/services/pdf/download-proposal-pdf";
import type { ProposalPdfCustomSettings } from "@/components/pdf/templates/ProposalPdfTemplate";

type PdfViewerSettings = ProposalPdfCustomSettings;

interface UsePdfGeneratorProps {
  proposal: Partial<Proposal>;
  template?: ProposalTemplate | null;
  tenant?: Tenant | null;
  customSettings?: PdfViewerSettings;
  showCover?: boolean;
  canonicalSource?: boolean;
  setIsOpen: (open: boolean) => void;
}

/**
 * Hook centralizado para download de PDF de propostas.
 *
 * SEGURANÇA: toda geração é feita no backend via Playwright.
 * Não existe mais fallback client-side (html2canvas / jspdf).
 * Somente propostas salvas (com id) podem ser baixadas — o backend
 * valida tenant ownership antes de gerar o arquivo.
 *
 * Os parâmetros `template`, `tenant`, `customSettings`, `showCover` e
 * `canonicalSource` são mantidos na interface apenas para retrocompatibilidade
 * com chamadores existentes. O backend ignora-os e usa os settings salvos no
 * Firestore como fonte canônica.
 */
export function usePdfGenerator({
  proposal,
  setIsOpen,
}: UsePdfGeneratorProps) {

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(
    async (
      _rootElementId?: string,
      _sourceLabel: "download" | "view" | "edit-preview" | "shared" = "download",
    ) => {
      void _rootElementId;
      void _sourceLabel;

      setIsGenerating(true);
      try {
        if (!proposal?.id) {
          toast.error("Salve a proposta antes de baixar o PDF.");
          return;
        }

        await downloadProposalPdfFromBackend(proposal.id, proposal.title);
        setIsOpen(false);
        toast.success("PDF baixado com sucesso!");
      } catch (error) {
        console.error("Erro ao gerar PDF:", error);
        toast.error("Erro ao gerar PDF.");
        setIsOpen(false);
      } finally {
        setIsGenerating(false);
      }
    },
    [proposal, setIsOpen],
  );

  return { isGenerating, handleGenerate };
}

