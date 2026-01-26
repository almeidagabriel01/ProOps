"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertCircle, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SharedProposalService } from "@/services/shared-proposal-service";
import { Proposal } from "@/types/proposal";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import { toast } from "react-toastify";

import { ProposalDefaults } from "@/lib/proposal-defaults";

export default function SharedProposalPage() {
  const params = useParams();
  const token = params.token as string;

  const [proposal, setProposal] = React.useState<Proposal | null>(null);
  const [template, setTemplate] = React.useState<any>(null); // Usar tipo correto se possível
  const [tenant, setTenant] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
        setTenant(data.tenant);

        // Synthesize template for fallback
        if (data.tenant) {
          const t = ProposalDefaults.createDefaultTemplate(
            data.tenant.id,
            data.tenant.name,
            data.tenant.primaryColor || "#2563eb",
          );
          setTemplate(t);
        }

        // Notificar visualização
        // toast.info("Você está visualizando uma proposta compartilhada", {
        //   position: "bottom-center",
        //   autoClose: 3000,
        // });
      } catch (err: any) {
        console.error("Error loading shared proposal:", err);

        if (
          err?.message?.includes("410") ||
          err?.response?.data?.code === "EXPIRED_LINK"
        ) {
          setError("Este link expirou. Solicite um novo link ao responsável.");
        } else if (err?.message?.includes("404")) {
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
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
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
        </div>
      </header>

      {/* PDF Viewer */}
      <main className="container mx-auto px-4 py-8 flex justify-center">
        <div className="w-full max-w-[210mm]">
          <Card className="overflow-hidden">
            <CardContent className="p-0 bg-gray-50/50">
              <ProposalPdfViewer
                proposal={proposal}
                tenant={tenant}
                template={template}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
