"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProposalTemplate } from "@/lib/mock-db"; // Types only
import { useTenant } from "@/providers/tenant-provider";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import { ArrowLeft, FileDown, Edit, Loader2, Palette } from "lucide-react";
import { ProposalService, Proposal } from "@/services/proposal-service";
import { ProposalDefaults } from "@/lib/proposal-defaults";

export default function ViewProposalPage() {
  const params = useParams();
  const router = useRouter();
  const { tenant } = useTenant();
  const proposalId = params.id as string;

  const [proposal, setProposal] = React.useState<Proposal | null>(null);
  const [template, setTemplate] = React.useState<ProposalTemplate | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);

  React.useEffect(() => {
    if (proposalId && tenant) {
      const fetchProposal = async () => {
        try {
          const p = await ProposalService.getProposalById(proposalId);
          if (p) {
            setProposal(p);
            // Synthesize template
            const t = ProposalDefaults.createDefaultTemplate(
              tenant.id,
              tenant.name,
              tenant.primaryColor
            );
            setTemplate(t);
          }
        } catch (error) {
          console.error("Error fetching proposal", error);
        }
        setIsLoading(false);
      };
      fetchProposal();
    }
  }, [proposalId, tenant]);

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      const previewElement = document.getElementById(
        "proposal-preview-content"
      );
      if (!previewElement) {
        alert("Erro: Preview não encontrado");
        return;
      }

      const canvas = await html2canvas(previewElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        onclone: (clonedDoc) => {
          const allElements = clonedDoc.querySelectorAll("*");
          allElements.forEach((el) => {
            const element = el as HTMLElement;
            const computedStyle = window.getComputedStyle(element);
            if (
              computedStyle.backgroundColor.includes("lab") ||
              computedStyle.backgroundColor.includes("oklab")
            ) {
              element.style.backgroundColor = "#ffffff";
            }
            if (
              computedStyle.color.includes("lab") ||
              computedStyle.color.includes("oklab")
            ) {
              element.style.color = "#000000";
            }
          });
        },
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      const filename = `proposta-${proposal?.title?.toLowerCase().replace(/\s+/g, "-") || "comercial"}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Proposta não encontrada</p>
        <Button variant="link" onClick={() => router.push("/proposals")}>
          Voltar para propostas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/proposals")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {proposal.title}
            </h1>
            <p className="text-muted-foreground text-sm">
              Cliente: {proposal.clientName} • {proposal.products?.length || 0}{" "}
              produto(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/proposals/${proposalId}/edit-pdf`)}
            className="gap-2"
          >
            <Palette className="w-4 h-4" />
            Editar PDF
          </Button>

          <Button
            variant="outline"
            onClick={() => router.push(`/proposals/${proposalId}`)}
            className="gap-2"
          >
            <Edit className="w-4 h-4" />
            Editar Dados
          </Button>

          <Button
            onClick={handleGeneratePdf}
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
                <FileDown className="w-4 h-4" />
                Baixar PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preview */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div
            id="proposal-preview-content"
            className="w-[210mm] mx-auto shadow-2xl"
            style={{ minWidth: "210mm" }}
          >
            <ProposalPdfViewer
              proposal={proposal}
              template={template} // Keep for fallback or minimal defaults
              tenant={tenant}
              // Inject saved settings from Firestore if available
              customSettings={proposal.pdfSettings as any}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
