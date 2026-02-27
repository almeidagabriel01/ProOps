"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProposalPdfSettings, ProposalSection } from "@/types";
import { Proposal } from "@/services/proposal-service";
import { useTenant } from "@/providers/tenant-provider";
import { Download, FileDown, Loader2 } from "lucide-react";
import { PdfSettingsTabs, usePdfGenerator } from "./pdf";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";
import { DEFAULT_PDF_FONT_FAMILY } from "@/services/pdf/pdf-fonts";

interface PdfGeneratorProps {
  proposal: Partial<Proposal>;
  sections: ProposalSection[];
}

export function PdfGenerator({ proposal, sections }: PdfGeneratorProps) {
  const { tenant } = useTenant();
  const [isOpen, setIsOpen] = React.useState(false);
  const [includeCover, setIncludeCover] = React.useState(true);
  const [coverTheme, setCoverTheme] = React.useState<
    "modern" | "classic" | "minimal"
  >("modern");

  const [settings, setSettings] = React.useState<ProposalPdfSettings>({
    primaryColor: tenant?.primaryColor || "#2563eb",
    secondaryColor: "#64748b",
    fontFamily: DEFAULT_PDF_FONT_FAMILY,
    includeLogo: true,
    includeHeader: true,
    includeFooter: true,
    margins: "normal",
    logoStyle: "original",
  });

  const pdfSections: PdfSection[] = React.useMemo(() => {
    return sections.map(
      (section) =>
        ({
          ...section,
          type: section.type as PdfSection["type"],
          styles: {}, // Provide default styles
        }) as PdfSection,
    );
  }, [sections]);

  const { isGenerating, handleGenerate } = usePdfGenerator({
    proposal,
    tenant,
    customSettings: {
      sections: pdfSections,
      primaryColor: settings.primaryColor,
      fontFamily: settings.fontFamily,
      theme: coverTheme,
      pageNumberStart: includeCover ? 2 : 1,
      logoStyle: settings.logoStyle,
    },
    showCover: includeCover,
    canonicalSource: false,
    setIsOpen,
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <FileDown className="w-4 h-4" />
            Gerar PDF
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurações do PDF</DialogTitle>
            <DialogDescription>
              Personalize sua proposta antes de gerar
            </DialogDescription>
          </DialogHeader>

          <PdfSettingsTabs
            settings={settings}
            setSettings={setSettings}
            includeCover={includeCover}
            setIncludeCover={setIncludeCover}
            coverTheme={coverTheme}
            setCoverTheme={setCoverTheme}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleGenerate(undefined, "download")}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
