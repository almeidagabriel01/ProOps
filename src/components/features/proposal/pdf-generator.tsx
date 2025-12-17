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
import { PdfCoverPage } from "./pdf-cover-page";
import { PdfSettingsTabs, usePdfGenerator } from "./pdf";

interface PdfGeneratorProps {
    proposal: Partial<Proposal>;
    sections: ProposalSection[];
}

export function PdfGenerator({ proposal, sections }: PdfGeneratorProps) {
    const { tenant } = useTenant();
    const [isOpen, setIsOpen] = React.useState(false);
    const [includeCover, setIncludeCover] = React.useState(true);
    const [coverTheme, setCoverTheme] = React.useState<"modern" | "classic" | "minimal">("modern");

    const [settings, setSettings] = React.useState<ProposalPdfSettings>({
        primaryColor: tenant?.primaryColor || "#2563eb",
        secondaryColor: "#64748b",
        fontFamily: "'Inter', sans-serif",
        includeLogo: true,
        includeHeader: true,
        includeFooter: true,
        margins: "normal",
    });

    const { isGenerating, handleGenerate } = usePdfGenerator({
        proposal,
        settings,
        includeCover,
        setIsOpen,
    });

    return (
        <>
            {/* Hidden Cover Page for PDF generation */}
            {includeCover && (
                <div className="fixed -left-[9999px] top-0">
                    <div id="pdf-cover-page" className="w-[210mm] h-[297mm]">
                        <PdfCoverPage proposal={proposal} theme={coverTheme} />
                    </div>
                </div>
            )}

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
                            onClick={handleGenerate}
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
