"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, FileText, FileDown } from "lucide-react";
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
  const { isGenerating, handleGenerate } = usePdfGenerator({
    proposal: proposal || {},
    template,
    tenant,
    customSettings:
      (proposal?.pdfSettings as Parameters<typeof ProposalPdfViewer>[0]["customSettings"]) ??
      undefined,
    showCover: true,
    setIsOpen: () => undefined,
  });

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
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tenant?.logoUrl && (
              <Image
                src={tenant.logoUrl}
                alt={tenant.name}
                width={40}
                height={40}
                className="h-10 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-lg font-semibold">
                {tenant?.name || "Proposta"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Visualização de Proposta
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium">{proposal.title}</p>
            <p className="text-sm text-muted-foreground">
              {proposal.clientName}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm"
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

      {/* PDF Viewer */}
      <main className="container mx-auto px-4 py-8 flex justify-center">
        <div className="w-full max-w-[210mm]">
          <Card className="overflow-hidden">
            <CardContent className="p-0 bg-gray-50/50">
              <div id="shared-proposal-preview-content">
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
