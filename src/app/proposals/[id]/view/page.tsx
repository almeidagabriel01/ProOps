"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Proposal } from "@/services/proposal-service"; // Types only
import { ProposalTemplate } from "@/types";
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
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { toast } from "react-toastify";

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
        toast.error("Erro: Preview não encontrado");
        return;
      }

      // --- DEEP FLATTENING HELPERS ---

      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const canvasCtx = canvas.getContext("2d", { willReadFrequently: true });

      // PIXEL READ STRATEGY: Guarantees RGB with Fallback
      const safeColor = (color: string, propertyName: string = "") => {
        if (!canvasCtx || !color || color === "none") return color;
        // Optimization
        if (color.startsWith("#") || color.startsWith("rgb")) return color;
        if (color === "transparent") return "transparent";

        try {
          canvasCtx.clearRect(0, 0, 1, 1);
          canvasCtx.fillStyle = color;
          canvasCtx.fillRect(0, 0, 1, 1);

          const [r, g, b, a] = canvasCtx.getImageData(0, 0, 1, 1).data;

          if (a === 0) {
            if (propertyName.toLowerCase() === 'color') return "#000000";
            if (propertyName.toLowerCase().includes("border") || propertyName.toLowerCase().includes("stroke")) return "#000000";
          }

          const rgba = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
          return rgba;
        } catch {
          if (propertyName.toLowerCase() === 'color') return "#000000";
          return "transparent";
        }
      };

      const containsModernColor = (value: string) => {
        return /(lab|oklch|oklab|lch|color)\(/.test(value);
      };

      const deepCloneWithStyles = (node: HTMLElement): HTMLElement => {
        const clone = node.cloneNode(false) as HTMLElement;

        clone.removeAttribute("id");
        clone.removeAttribute("class");

        const computed = window.getComputedStyle(node);

        // COMPREHENSIVE LIST OF PROPERTIES FOR VISUAL FIDELITY
        const propertiesToCopy = [
          // Layout Enforcers (Critical)
          "display", "position", "boxSizing",
          "top", "left", "right", "bottom",
          "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
          "margin", "marginTop", "marginBottom", "marginLeft", "marginRight",
          "padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight",

          // Borders
          "borderTopWidth", "borderBottomWidth", "borderLeftWidth", "borderRightWidth",
          "borderTopStyle", "borderBottomStyle", "borderLeftStyle", "borderRightStyle",
          "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor",
          "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius",
          "outline", "outlineColor", "outlineStyle", "outlineWidth",

          // Flex & Grid
          "flex", "flexDirection", "flexWrap", "justifyContent", "alignItems", "alignContent", "gap", "order", "flexGrow", "flexShrink", "flexBasis",
          "gridTemplateColumns", "gridTemplateRows", "gridTemplateAreas", "gridAutoColumns", "gridAutoRows", "gridAutoFlow", "gridColumn", "gridRow", "gridArea", "columnGap", "rowGap",

          // Typography
          "font", "fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textAlign", "textTransform", "textDecoration", "textDecorationColor", "textUnderlineOffset", "whiteSpace", "wordBreak", "overflowWrap", "textOverflow", "verticalAlign",

          // Visuals
          "color", "backgroundColor",
          "opacity", "visibility", "zIndex",
          "boxShadow", "overflow", "overflowX", "overflowY",
          "transform", "transformOrigin",
          "fill", "stroke", "strokeWidth",
          "objectFit", "objectPosition", "aspectRatio"
        ];

        propertiesToCopy.forEach(prop => {
          let val = computed[prop as keyof CSSStyleDeclaration];
          if (!val || typeof val !== 'string') return;

          // 1. Sanitize Colors
          if (typeof val === 'string') {
            if (prop.toLowerCase().includes("color") || prop.toLowerCase() === "fill" || prop.toLowerCase() === "stroke") {
              val = safeColor(val, prop);
            }
            // 2. Kill Complex Bad Color Strings
            else if (containsModernColor(val)) {
              if (prop.toLowerCase().includes("shadow")) {
                val = "none";
              } else {
                val = "";
              }
            }
          }

          if (val) {
            const kebab = prop.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
            clone.style.setProperty(kebab, val, "important");
          }
        });

        // Background Image Sanitize
        if (computed.backgroundImage && computed.backgroundImage !== "none") {
          if (containsModernColor(computed.backgroundImage)) {
            clone.style.backgroundImage = "none";
            clone.style.backgroundColor = safeColor(computed.backgroundColor, "backgroundColor");
          } else {
            clone.style.backgroundImage = computed.backgroundImage;
          }
        }

        if (node instanceof HTMLImageElement) {
          (clone as HTMLImageElement).src = node.src;
          (clone as HTMLImageElement).loading = "eager";
        }

        // SVG HANDLING
        if (node instanceof SVGElement) {
          const fill = computed.fill;
          const stroke = computed.stroke;
          if (fill && containsModernColor(fill)) {
            clone.style.setProperty("fill", safeColor(fill, "fill"), "important");
          }
          if (stroke && containsModernColor(stroke)) {
            clone.style.setProperty("stroke", safeColor(stroke, "stroke"), "important");
          }
        }

        // --- CRITICAL FIX: USE childNodes INSTEAD OF children TO INCLUDE TEXT NODES ---
        Array.from(node.childNodes).forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE) { // 1
            clone.appendChild(deepCloneWithStyles(child as HTMLElement));
          } else if (child.nodeType === Node.TEXT_NODE) { // 3
            clone.appendChild(child.cloneNode(true));
          } else if (child.nodeType === Node.COMMENT_NODE) {
            // Ignore comments
          } else {
            // Clone other types (like CDATA) just in case
            clone.appendChild(child.cloneNode(true));
          }
        });

        return clone;
      };

      // --- EXECUTION (IFRAME ISOLATION) ---

      const iframe = document.createElement("iframe");
      iframe.style.position = "absolute";
      iframe.style.left = "-9999px";
      iframe.style.top = "0";
      iframe.style.width = "210mm";
      iframe.style.height = "297mm";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      if (!iframe.contentDocument || !iframe.contentWindow) {
        throw new Error("Iframe could not be created");
      }

      const iframeDoc = iframe.contentDocument;

      try {
        // --- 1. FONT INJECTION ---
        const styleElement = iframeDoc.createElement("style");
        let fontFaceRules = "";

        try {
          Array.from(document.styleSheets).forEach(sheet => {
            try {
              Array.from(sheet.cssRules).forEach(rule => {
                if (rule.type === CSSRule.FONT_FACE_RULE) {
                  let ruleText = rule.cssText;
                  ruleText = ruleText.replace(
                    /url\((['"]?)\//g,
                    `url($1${window.location.origin}/`
                  );
                  fontFaceRules += ruleText + "\n";
                }
              });
            } catch {
              // Ignore
            }
          });
        } catch (e) {
          console.warn("Could not copy fonts", e);
        }

        styleElement.textContent = fontFaceRules;
        iframeDoc.head.appendChild(styleElement);


        // --- 2. CLONE & INSERT ---
        const clonedElement = deepCloneWithStyles(previewElement);

        // Reset margins
        clonedElement.style.margin = "0";
        clonedElement.style.marginLeft = "0";
        clonedElement.style.marginRight = "0";
        clonedElement.style.marginTop = "0";
        clonedElement.style.marginBottom = "0";
        clonedElement.style.boxShadow = "none";
        clonedElement.style.transform = "none";

        const container = iframeDoc.createElement("div");
        container.style.width = "210mm";
        container.style.minWidth = "210mm";
        container.style.maxWidth = "210mm";
        container.style.backgroundColor = "#ffffff";
        container.appendChild(clonedElement);

        iframeDoc.body.style.margin = "0";
        iframeDoc.body.style.padding = "0";
        iframeDoc.body.appendChild(container);

        // --- 3. WAIT ---
        try {
          await iframeDoc.fonts.ready;
        } catch (e) {
          console.warn("Font loading wait failed", e);
        }

        // --- 4. PROXY ---
        const images = Array.from(container.querySelectorAll("img"));
        if (images.length > 0) {
          const proxyImageFn = httpsCallable<
            { url: string },
            { success: boolean; dataUrl: string }
          >(functions, "proxyImage");

          const uniqueUrls = new Set(
            images
              .map((img) => img.src)
              .filter((src) => src && !src.startsWith("data:"))
          );

          const urlMap = new Map<string, string>();

          await Promise.all(
            Array.from(uniqueUrls).map(async (url) => {
              try {
                const result = await proxyImageFn({ url });
                if (result.data.success) {
                  urlMap.set(url, result.data.dataUrl);
                }
              } catch {
                console.warn("Failed to proxy image:", url);
              }
            })
          );

          images.forEach((img) => {
            if (urlMap.has(img.src)) {
              img.src = urlMap.get(img.src)!;
            }
          });

          await Promise.all(
            images.map((img) => new Promise<void>((resolve) => {
              if (img.complete) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            }))
          );

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // --- 5. RENDER EACH PAGE INDIVIDUALLY ---
        const pageContainers = container.querySelectorAll('[data-page-index]');

        if (pageContainers.length === 0) {
          toast.error("Erro: Nenhuma página encontrada para gerar PDF");
          return;
        }

        const pdf = new jsPDF("p", "mm", "a4");
        const pageWidth = 210;
        const pageHeight = 297;

        // Capture and add each page individually
        for (let i = 0; i < pageContainers.length; i++) {
          const pageElement = pageContainers[i] as HTMLElement;

          // Capture this specific page
          const pageCanvas = await html2canvas(pageElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: true,
            backgroundColor: "#ffffff",
            width: 794,  // Fixed A4 width
            height: 1123, // Fixed A4 height
          });

          // Add page to PDF (add new page for all except first)
          if (i > 0) {
            pdf.addPage();
          }

          // Add the page image to fill the entire PDF page
          pdf.addImage(
            pageCanvas.toDataURL("image/jpeg", 0.95),
            "JPEG",
            0,
            0,
            pageWidth,
            pageHeight
          );
        }


        const filename = `proposta-${proposal?.title?.toLowerCase().replace(/\s+/g, "-") || "comercial"}.pdf`;
        pdf.save(filename);

      } finally {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF: Cores não suportadas detectadas.");
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
            className="mx-auto shadow-2xl"
            style={{ width: "794px", minWidth: "794px" }}
          >
            <ProposalPdfViewer
              proposal={proposal}
              template={template} // Keep for fallback or minimal defaults
              tenant={tenant}
              // Inject saved settings from Firestore if available
              customSettings={(proposal.pdfSettings as Parameters<typeof ProposalPdfViewer>[0]['customSettings']) ?? undefined}
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
