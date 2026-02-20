"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  FileText,
  FileDown,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SharedProposalService } from "@/services/shared-proposal-service";
import { Proposal } from "@/types/proposal";
import { Tenant, ProposalTemplate } from "@/types";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import Image from "next/image";

import { ProposalDefaults } from "@/lib/proposal-defaults";
import { usePdfGenerator } from "@/components/features/proposal/pdf/use-pdf-generator";

export default function SharedProposalPage() {
  const params = useParams();
  const token = params.token as string;

  const [proposal, setProposal] = React.useState<Proposal | null>(null);
  const [template, setTemplate] = React.useState<ProposalTemplate | null>(null);
  const [tenant, setTenant] = React.useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = React.useState(1);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = React.useState(0);

  const { isGenerating, handleGenerate } = usePdfGenerator({
    proposal: proposal || {},
    template,
    tenant,
    customSettings:
      (proposal?.pdfSettings as Parameters<
        typeof ProposalPdfViewer
      >[0]["customSettings"]) ?? undefined,
    showCover: true,
    setIsOpen: () => undefined,
  });

  React.useEffect(() => {
    // Auto-fit PDF on mobile screens initially and on resize
    const handleResize = () => {
      if (window.innerWidth < 850) {
        // Leave some margin (32px) around the 794px A4 width
        const scale = Math.max(0.2, (window.innerWidth - 32) / 794);
        setPreviewZoom(scale);
      } else {
        setPreviewZoom(1);
      }
    };

    // Set initial size
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.contentRect.height);
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [proposal, template]);

  React.useEffect(() => {
    const loadSharedProposal = async () => {
      if (!token) {
        setError("Token inválido");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const data = await SharedProposalService.getSharedProposal(token);
        setProposal(data.proposal);
        const tenantData = data.tenant as Tenant;
        setTenant(tenantData);

        // Synthesize template for fallback
        if (tenantData) {
          const t = ProposalDefaults.createDefaultTemplate(
            tenantData.id,
            tenantData.name,
            tenantData.primaryColor || "#2563eb",
          );
          setTemplate(t);
        }

        // Notificar visualização
        // toast.info("Você está visualizando uma proposta compartilhada", {
        //   position: "bottom-center",
        //   autoClose: 3000,
        // });
      } catch (err: unknown) {
        console.error("Error loading shared proposal:", err);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorAny = err as any;

        if (
          errorAny?.message?.includes("410") ||
          errorAny?.response?.data?.code === "EXPIRED_LINK"
        ) {
          setError("Este link expirou. Solicite um novo link ao responsável.");
        } else if (errorAny?.message?.includes("404")) {
          setError("Link inválido ou proposta não encontrada.");
        } else {
          setError("Erro ao carregar proposta. Tente novamente mais tarde.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSharedProposal();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando proposta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>Proposta não encontrada</AlertTitle>
              <AlertDescription>
                Não foi possível localizar esta proposta.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header simplificado com branding do tenant */}
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <div className="flex items-center gap-3 overflow-hidden">
              {tenant?.logoUrl && (
                <Image
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  width={40}
                  height={40}
                  className="h-10 w-auto object-contain shrink-0 rounded-md"
                />
              )}
              <div className="min-w-0 pr-2">
                <h1 className="text-base md:text-lg font-bold truncate leading-tight text-foreground">
                  {tenant?.name || "Proposta"}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground truncate">
                  Visualização de Proposta
                </p>
              </div>
            </div>

            <button
              type="button"
              className="md:hidden shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md shadow-md flex-none transition-all cursor-pointer hover:opacity-90 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              style={
                tenant?.primaryColor
                  ? {
                      backgroundColor: tenant.primaryColor,
                      color: "#ffffff",
                      borderColor: tenant.primaryColor,
                    }
                  : {
                      backgroundColor: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                    }
              }
              onClick={() => handleGenerate(undefined, "shared")}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Baixar PDF
            </button>
          </div>

          <div className="w-full md:flex-1 md:text-right flex flex-col md:items-end justify-center min-w-0 border-t md:border-t-0 pt-3 md:pt-0 md:pr-4">
            <p className="font-semibold text-sm md:text-base leading-snug w-full truncate text-foreground">
              {proposal.title}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground w-full truncate">
              {proposal.clientName}
            </p>
          </div>

          <button
            type="button"
            className="hidden md:inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md text-sm font-bold transition-all shadow-sm border border-transparent cursor-pointer hover:brightness-110 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            style={
              tenant?.primaryColor
                ? {
                    backgroundColor: tenant.primaryColor,
                    color: "#ffffff",
                    borderColor: tenant.primaryColor,
                  }
                : {
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  }
            }
            onClick={() => handleGenerate(undefined, "shared")}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Baixar PDF
          </button>
        </div>
      </header>

      {/* PDF View Area */}
      <main className="flex-1 w-full bg-muted/20 overflow-hidden flex flex-col relative">
        <div className="container mx-auto px-4 py-4 w-full flex justify-center">
          <div className="w-full max-w-[794px] flex items-center justify-between bg-card border rounded-lg p-2 shadow-sm z-10">
            <span className="text-sm font-medium text-muted-foreground px-2">
              Visualização da Proposta
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors cursor-pointer"
                onClick={() => setPreviewZoom((z) => Math.max(0.2, z - 0.1))}
                title="Diminuir zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground w-12 text-center select-none block">
                {Math.round(previewZoom * 100)}%
              </span>
              <button
                type="button"
                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors cursor-pointer"
                onClick={() => setPreviewZoom((z) => Math.min(2, z + 0.1))}
                title="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="w-full flex-1 overflow-auto px-4 sm:px-8 pb-32 pt-4 flex justify-center">
          <div
            id="shared-proposal-preview-content"
            ref={contentRef}
            className="mx-auto shadow-2xl border bg-white origin-top transition-transform duration-200"
            style={{
              width: "794px",
              minHeight: "1123px", // A4 Ratio
              transform: `scale(${previewZoom})`,
              marginBottom: contentHeight
                ? `-${contentHeight * (1 - previewZoom)}px`
                : undefined,
            }}
          >
            <ProposalPdfViewer
              proposal={proposal}
              tenant={tenant}
              template={template}
              customSettings={
                (proposal.pdfSettings as Parameters<
                  typeof ProposalPdfViewer
                >[0]["customSettings"]) ?? undefined
              }
            />
          </div>
        </div>
      </main>
    </div>
  );
}
