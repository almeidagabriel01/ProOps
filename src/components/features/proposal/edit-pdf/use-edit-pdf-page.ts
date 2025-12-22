"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ProposalService, Proposal } from "@/services/proposal-service";
import { ProposalDefaults } from "@/lib/proposal-defaults";
import {
  PdfSection,
  createDefaultSections,
} from "@/components/features/proposal/pdf-section-editor";
import { ProposalTemplate } from "@/types";
import { ThemeType } from "./pdf-theme-utils";

export function useEditPdfPage() {
  const params = useParams();
  const router = useRouter();
  const { tenant } = useTenant();
  const { features, isLoading: isPlanLoading } = usePlanLimits();
  const proposalId = params.id as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [template, setTemplate] = useState<ProposalTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Cover settings
  const [coverTitle, setCoverTitle] = useState("");
  const [coverImage, setCoverImage] = useState<string>("");
  const [coverLogo, setCoverLogo] = useState<string>("");
  const [coverImageOpacity, setCoverImageOpacity] = useState(30);
  const [coverImageFit, setCoverImageFit] = useState<"cover" | "contain">(
    "cover"
  );
  const [coverImagePosition, setCoverImagePosition] = useState("center");
  const [theme, setTheme] = useState<ThemeType>("modern");

  // Style settings
  const [primaryColor, setPrimaryColor] = useState(
    tenant?.primaryColor || "#2563eb"
  );
  const [fontFamily, setFontFamily] = useState("'Inter', sans-serif");

  // Editable sections
  const [sections, setSections] = useState<PdfSection[]>([]);
  const [repeatHeader, setRepeatHeader] = useState(false);

  // Preview zoom
  const [previewZoom, setPreviewZoom] = useState(0.5);

  // Check plan access features
  const maxPdfTemplates = features?.maxPdfTemplates ?? 1;
  const canEditPdfSections = features?.canEditPdfSections ?? false;

  // Pro and Enterprise can access (maxPdfTemplates > 1 or unlimited)
  const canAccessPage = maxPdfTemplates === -1 || maxPdfTemplates > 1;

  useEffect(() => {
    // Only fetch if user has access
    if (!canAccessPage && !isPlanLoading) return;

    if (proposalId && tenant) {
      const fetchProposal = async () => {
        try {
          const p = await ProposalService.getProposalById(proposalId);
          if (p) {
            // Inject placeholders for missing images (for demo purposes)
            if (p.products) {
              p.products = p.products.map((prod) => ({
                ...prod,
                productImage:
                  prod.productImage ||
                  "https://placehold.co/200x200/e2e8f0/64748b?text=Produto",
                productImages:
                  prod.productImages && prod.productImages.length > 0
                    ? prod.productImages
                    : [
                        prod.productImage ||
                          "https://placehold.co/200x200/e2e8f0/64748b?text=Produto",
                      ],
              }));
            } else {
              p.products = [];
            }

            setProposal(p);

            // 1. Check if we have saved PDF settings in the proposal
            if (p.pdfSettings) {
              const s = p.pdfSettings;

              // We MUST set a template object because the render guard requires it
              const baseTemplate = ProposalDefaults.createDefaultTemplate(
                tenant.id,
                tenant.name,
                s.primaryColor || tenant.primaryColor
              );
              setTemplate(baseTemplate);

              // Load saved settings
              setCoverTitle(p.title || "");
              if (s.primaryColor) {
                setPrimaryColor(s.primaryColor);
              } else {
                setPrimaryColor(tenant.primaryColor || "#2563eb");
              }
              if (s.fontFamily) setFontFamily(s.fontFamily);
              if (s.theme) setTheme(s.theme as ThemeType);

              if (s.coverImage) setCoverImage(s.coverImage);
              if (s.coverLogo) setCoverLogo(s.coverLogo);
              else if (tenant.logoUrl) setCoverLogo(tenant.logoUrl);

              if (s.coverImageOpacity !== undefined)
                setCoverImageOpacity(s.coverImageOpacity);
              if (s.coverImageFit) setCoverImageFit(s.coverImageFit);
              if (s.coverImagePosition)
                setCoverImagePosition(s.coverImagePosition);
              if (s.repeatHeader !== undefined) setRepeatHeader(s.repeatHeader);

              // Load sections
              if (s.sections && s.sections.length > 0) {
                setSections(s.sections as PdfSection[]);
              } else {
                const t = ProposalDefaults.createDefaultTemplate(
                  tenant.id,
                  tenant.name,
                  s.primaryColor || tenant.primaryColor
                );
                setSections(createDefaultSections(t, t.primaryColor));
              }
            } else {
              // 2. No saved settings, initialize from Defaults
              const t = ProposalDefaults.createDefaultTemplate(
                tenant.id,
                tenant.name,
                tenant.primaryColor
              );

              if (t) {
                setTemplate(t);
                setCoverTitle(p.title || "");
                setPrimaryColor(t.primaryColor);
                setFontFamily(t.fontFamily);
                setTheme(t.theme as ThemeType);
                if (t.coverImage) setCoverImage(t.coverImage);

                if (tenant.logoUrl) setCoverLogo(tenant.logoUrl);

                setCoverImageOpacity(30);
                setCoverImageFit("cover");
                setCoverImagePosition("center");
                setRepeatHeader(false);

                setSections(createDefaultSections(t, t.primaryColor));
              }
            }
          }
        } catch (error) {
          console.error("Error fetching proposal for edit-pdf", error);
        }
        setIsLoading(false);
      };
      fetchProposal();
    }
  }, [proposalId, tenant, canAccessPage, isPlanLoading]);

  const handleSave = async () => {
    if (!proposal || !template) return;
    setIsSaving(true);

    try {
      const cleanForFirestore = (obj: unknown): unknown => {
        if (obj === undefined) return null;
        if (obj === null) return null;
        if (obj instanceof Blob || obj instanceof File) return null;
        if (obj instanceof Element) return null;
        if (typeof obj !== "object") return obj;

        // Check for nativeEvent (React SyntheticEvent)
        const objRecord = obj as Record<string, unknown>;
        if ("nativeEvent" in objRecord) return null;

        if (Array.isArray(obj)) return obj.map((v) => cleanForFirestore(v));
        if (obj instanceof Date) return obj.toISOString();

        const newObj: Record<string, unknown> = {};
        for (const key in objRecord) {
          if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
            const val = objRecord[key];
            if (typeof val === "function" || typeof val === "symbol") continue;
            newObj[key] = cleanForFirestore(val);
          }
        }
        return newObj;
      };

      const settings = {
        theme,
        primaryColor,
        fontFamily,
        coverTitle,
        coverImage,
        coverLogo,
        coverImageOpacity,
        coverImageFit,
        coverImagePosition,
        repeatHeader,
        sections,
      };

      const sanitizedSettings = cleanForFirestore(settings);
      const payloadSize = JSON.stringify(sanitizedSettings).length;
      if (payloadSize > 950000) {
        alert(
          `O documento está muito grande (${Math.round(payloadSize / 1024)}KB). O limite do banco de dados é 1MB. Por favor, reduza o tamanho das imagens ou remova algumas.`
        );
        setIsSaving(false);
        return;
      }

      await ProposalService.updateProposal(proposal.id, {
        title: coverTitle,
        pdfSettings: sanitizedSettings as Proposal["pdfSettings"],
      });

      toast.success("Proposta e personalizações salvas com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      // Select all specific page containers
      const pageElements = document.querySelectorAll(".pdf-page-container");
      if (!pageElements || pageElements.length === 0) {
        alert("Erro: Páginas não encontradas");
        return;
      }

      await document.fonts.ready;

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;

      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.top = "-9999px";
      container.style.left = "-9999px";
      container.style.width = "210mm";
      container.style.height = "297mm";
      document.body.appendChild(container);

      try {
        for (let i = 0; i < pageElements.length; i++) {
          const originalPage = pageElements[i] as HTMLElement;
          const clonedPage = originalPage.cloneNode(true) as HTMLElement;

          clonedPage.style.transform = "none";
          clonedPage.style.margin = "0";
          clonedPage.style.boxShadow = "none";

          container.innerHTML = "";
          container.appendChild(clonedPage);

          const canvas = await html2canvas(clonedPage, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            width: container.offsetWidth,
            height: container.offsetHeight,
            windowWidth: container.offsetWidth,
            windowHeight: container.offsetHeight,
            onclone: (clonedDoc) => {
              const allElements = clonedDoc.querySelectorAll("*");
              allElements.forEach((el) => {
                const element = el as HTMLElement;
                const cs = window.getComputedStyle(element);
                
                const hasModernColor = (value: string) => {
                  return value && (
                    value.includes("lab(") ||
                    value.includes("oklab(") ||
                    value.includes("lch(") ||
                    value.includes("oklch(") ||
                    value.includes("color(")
                  );
                };
                
                if (hasModernColor(cs.backgroundColor)) {
                  element.style.backgroundColor = "#ffffff";
                }
                if (hasModernColor(cs.color)) {
                  element.style.color = "#000000";
                }
                if (hasModernColor(cs.borderColor)) {
                  element.style.borderColor = "transparent";
                }
                if (hasModernColor(cs.boxShadow)) {
                  element.style.boxShadow = "none";
                }
              });
            },
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.95);

          if (i > 0) {
            pdf.addPage();
          }

          pdf.addImage(imgData, "JPEG", 0, 0, pageWidth, pageHeight);
        }
      } finally {
        document.body.removeChild(container);
      }

      pdf.save(
        `proposta-${proposal?.title?.toLowerCase().replace(/\s+/g, "-") || "comercial"}.pdf`
      );
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    proposal,
    template,
    tenant,
    isLoading,
    isPlanLoading,
    canAccessPage,
    isSaving,
    isGenerating,
    showUpgradeModal,
    setShowUpgradeModal,

    // Cover
    coverTitle,
    setCoverTitle,
    coverImage,
    setCoverImage,
    coverLogo,
    setCoverLogo,
    coverImageOpacity,
    setCoverImageOpacity,
    coverImageFit,
    setCoverImageFit,
    coverImagePosition,
    setCoverImagePosition,

    // Theme
    theme,
    setTheme,
    primaryColor,
    setPrimaryColor,
    fontFamily,
    setFontFamily,

    // Sections
    sections,
    setSections,
    repeatHeader,
    setRepeatHeader,
    canEditPdfSections,
    maxPdfTemplates,

    // Preview
    previewZoom,
    setPreviewZoom,

    // Actions
    handleSave,
    handleGeneratePdf,
  };
}
