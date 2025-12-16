"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Proposal } from "@/services/proposal-service"; // Types only
import { ProposalStatus, ProposalTemplate } from "@/types";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import {
  ArrowLeft,
  FileDown,
  Edit,
  Loader2,
  Palette,
  Crown,
} from "lucide-react";
import { ProposalService } from "@/services/proposal-service";
import { ProposalDefaults } from "@/lib/proposal-defaults";

export default function ViewProposalPage() {
  const params = useParams();
  const router = useRouter();
  const { tenant } = useTenant();
  const { features } = usePlanLimits();
  const { canEdit } = usePagePermission("proposals");
  const upgradeModal = useUpgradeModal();
  const proposalId = params.id as string;

  // Pro and Enterprise can access Edit PDF (maxPdfTemplates > 1)
  const canAccessEditPdf =
    features &&
    (features.maxPdfTemplates === -1 || features.maxPdfTemplates > 1);

  const [proposal, setProposal] = React.useState<Proposal | null>(null);
  const [template, setTemplate] = React.useState<ProposalTemplate | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Helper function to lighten a hex color
  const lightenColor = (hex: string, percent: number): string => {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return (
      "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)
    );
  };

  const primaryColor = tenant?.primaryColor || "#2563eb";
  const premiumColor = lightenColor(primaryColor, 25);

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
          {canEdit && canAccessEditPdf && (
            <Button
              variant="outline"
              onClick={() => router.push(`/proposals/${proposalId}/edit-pdf`)}
              className="gap-2"
            >
              <Palette className="w-4 h-4" />
              Editar PDF
            </Button>
          )}
          {canEdit && !canAccessEditPdf && (
            <Button
              variant="outline"
              onClick={() =>
                upgradeModal.showUpgradeModal(
                  "Editor de PDF",
                  "Personalize completamente suas propostas com nosso editor avançado de seções.",
                  "pro"
                )
              }
              className="gap-2 hover:bg-primary/10"
              style={{ color: premiumColor }}
            >
              <Crown className="w-4 h-4" />
              Editar PDF
            </Button>
          )}

          {canEdit && (
            <Button
              variant="outline"
              onClick={() => router.push(`/proposals/${proposalId}`)}
              className="gap-2"
            >
              <Edit className="w-4 h-4" />
              Editar Dados
            </Button>
          )}

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

      {/* Upgrade Modal */}
      <UpgradeModal
        open={upgradeModal.isOpen}
        onOpenChange={upgradeModal.setIsOpen}
        feature={upgradeModal.feature}
        description={upgradeModal.description}
        requiredPlan={upgradeModal.requiredPlan}
      />
    </div>
  );
}
