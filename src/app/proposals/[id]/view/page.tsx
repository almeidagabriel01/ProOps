"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Proposal } from "@/types/proposal";
import { ProposalTemplate } from "@/types";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { usePagePermission } from "@/hooks/usePagePermission";
import { UpgradeModal, useUpgradeModal } from "@/components/ui/upgrade-modal";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import {
  ArrowLeft,
  FileDown,
  Pencil,
  Loader2,
  Palette,
  Crown,
} from "lucide-react";
import { ProposalService } from "@/services/proposal-service";
import { ProposalDefaults } from "@/lib/proposal-defaults";
import { toast } from '@/lib/toast';
import { usePdfGenerator } from "@/components/features/proposal/pdf/use-pdf-generator";

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
            // Block draft proposals from being viewed
            if (p.status === "draft") {
              toast.error(
                "Propostas em rascunho não podem ser visualizadas. Edite a proposta para ativá-la.",
              );
              router.push(`/proposals/${proposalId}`);
              return;
            }

            // Sync client data from source if clientId exists
            if (p.clientId) {
              try {
                const { ClientService } =
                  await import("@/services/client-service");
                const freshClient = await ClientService.getClientById(
                  p.clientId,
                );
                if (freshClient) {
                  p.clientName = freshClient.name || p.clientName;
                  p.clientEmail = freshClient.email || p.clientEmail;
                  p.clientPhone = freshClient.phone || p.clientPhone;
                  p.clientAddress = freshClient.address || p.clientAddress;
                }
              } catch (clientError) {
                console.warn("Could not fetch fresh client data:", clientError);
              }
            }

            // Sync product data from products collection
            if (p.products && p.products.length > 0) {
              try {
                const { ProductService } =
                  await import("@/services/product-service");
                const allProducts = await ProductService.getProducts(tenant.id);

                p.products = p.products.map((pp) => {
                  const freshProduct = allProducts.find(
                    (prod) => prod.id === pp.productId,
                  );
                  if (freshProduct) {
                    const price =
                      parseFloat(freshProduct.price) || pp.unitPrice;
                    const markup =
                      pp.markup !== undefined
                        ? pp.markup
                        : parseFloat(freshProduct.markup || "0");
                    const sellingPrice = price * (1 + markup / 100);
                    return {
                      ...pp,
                      productName: freshProduct.name,
                      productImage:
                        freshProduct.images?.[0] ||
                        freshProduct.image ||
                        pp.productImage ||
                        "",
                      productImages:
                        freshProduct.images || pp.productImages || [],
                      productDescription:
                        freshProduct.description || pp.productDescription || "",
                      unitPrice: price,
                      markup: markup,
                      total: pp.quantity * sellingPrice,
                      manufacturer:
                        freshProduct.manufacturer || pp.manufacturer,
                      category: freshProduct.category || pp.category,
                    };
                  }
                  return pp;
                });
              } catch (productError) {
                console.warn(
                  "Could not fetch fresh product data:",
                  productError,
                );
              }
            }

            // Sync system data (descriptions) to ensure PDF shows latest master data
            if (p.sistemas && p.sistemas.length > 0) {
              try {
                const { SistemaService } =
                  await import("@/services/sistema-service");
                const { AmbienteService } =
                  await import("@/services/ambiente-service");

                const [allSistemas, allAmbientes] = await Promise.all([
                  SistemaService.getSistemas(tenant.id),
                  AmbienteService.getAmbientes(tenant.id),
                ]);

                // Update system and environment descriptions
                p.sistemas = p.sistemas.map((ps) => {
                  const masterSistema = allSistemas.find(
                    (s) => s.id === ps.sistemaId,
                  );
                  if (!masterSistema) return ps;

                  const updatedSystem = {
                    ...ps,
                    // Update system description if available in master
                    description: masterSistema.description || ps.description,
                  };

                  if (updatedSystem.ambientes) {
                    updatedSystem.ambientes = updatedSystem.ambientes.map(
                      (pa) => {
                        const masterAmbiente = allAmbientes.find(
                          (a) => a.id === pa.ambienteId,
                        );
                        // Check for system-specific environment override
                        const systemEnvConfig = masterSistema.ambientes?.find(
                          (a) => a.ambienteId === pa.ambienteId,
                        );

                        return {
                          ...pa,
                          // Update environment description: System Override > Global > Snapshot
                          description:
                            systemEnvConfig?.description ||
                            masterAmbiente?.description ||
                            pa.description,
                        };
                      },
                    );
                  }
                  return updatedSystem;
                });
              } catch (sysError) {
                console.warn("Could not fetch fresh system data:", sysError);
              }
            }

            setProposal(p);
            // Synthesize template
            const t = ProposalDefaults.createDefaultTemplate(
              tenant.id,
              tenant.name,
              tenant.primaryColor || "#2563eb",
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
  }, [proposalId, tenant, router]);

  const handleGeneratePdf = React.useCallback(() => {
    handleGenerate(undefined, "view");
  }, [handleGenerate]);

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
                  "pro",
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
              <Pencil className="w-4 h-4" />
              Editar Dados
            </Button>
          )}

          <Button
            onClick={handleGeneratePdf}
            disabled={isGenerating || !proposal}
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
            className="mx-auto shadow-2xl"
            style={{ width: "794px", minWidth: "794px" }}
          >
            <ProposalPdfViewer
              proposal={proposal}
              template={template} // Keep for fallback or minimal defaults
              tenant={tenant}
              // Inject saved settings from Firestore if available
              customSettings={
                (proposal.pdfSettings as Parameters<
                  typeof ProposalPdfViewer
                >[0]["customSettings"]) ?? undefined
              }
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


