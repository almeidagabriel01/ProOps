"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "react-toastify";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ProposalService } from "@/services/proposal-service";
import { Proposal } from "@/types/proposal";
import { ProposalDefaults } from "@/lib/proposal-defaults";
import { PAGE_WIDTH_PX, PAGE_HEIGHT_PX } from "@/utils/pdf-layout";
import {
  PdfSection,
  CoverElement,
  createDefaultSections,
  createDefaultCoverElements,
} from "@/components/features/proposal/pdf-section-editor";
import { ProposalTemplate } from "@/types";
import { ThemeType } from "./pdf-theme-utils";
import { generatePaymentTerms, hydrateSections } from "./pdf-hydration-utils";

interface PdfSettings {
  primaryColor?: string;
  fontFamily?: string;
  theme?: string;
  coverImage?: string;
  coverLogo?: string;
  coverImageOpacity?: number;
  coverImageFit?: "cover" | "contain";
  coverImagePosition?: string;
  repeatHeader?: boolean;
  sections?: unknown[];
  coverElements?: CoverElement[];
  logoStyle?: "original" | "rounded" | "circle";
}

export function useEditPdfPage() {
  const params = useParams();
  const { tenant, refreshTenant } = useTenant();
  const { features, isLoading: isPlanLoading } = usePlanLimits();
  const proposalId = params.id as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [template, setTemplate] = useState<ProposalTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isSavingDefault, setIsSavingDefault] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Cover settings
  const [coverTitle, setCoverTitle] = useState("");
  const [coverImage, setCoverImage] = useState<string>("");
  const [coverLogo, setCoverLogo] = useState<string>("");
  const [logoStyle, setLogoStyle] = useState<"original" | "rounded" | "circle">(
    "original",
  );
  const [coverImageOpacity, setCoverImageOpacity] = useState(30);
  const [coverImageFit, setCoverImageFit] = useState<"cover" | "contain">(
    "cover",
  );
  const [coverImagePosition, setCoverImagePosition] = useState("center");
  const [theme, setTheme] = useState<ThemeType>("modern");

  // Style settings
  const [primaryColor, setPrimaryColor] = useState(
    tenant?.primaryColor || "#2563eb",
  );
  const [fontFamily, setFontFamily] = useState("'Inter', sans-serif");

  // Editable sections
  const [sections, setSections] = useState<PdfSection[]>([]);
  const [repeatHeader, setRepeatHeader] = useState(false);

  // Cover elements
  const [coverElements, setCoverElements] = useState<CoverElement[]>([]);

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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              p.products = p.products.map((prod: any) => ({
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                p.sistemas = p.sistemas.map((ps: any) => {
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
                      (pa: {
                        ambienteId: string;
                        description?: string;
                        [key: string]: unknown;
                      }) => {
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

            // ORDEM DE PRIORIDADE NO CARREGAMENTO DAS CONFIGURAÇÕES:
            // 1. pdfSettings da proposta (se existir) - Configurações específicas desta proposta
            // 2. proposalDefaults do tenant - Configurações padrão para novas propostas
            // 3. Configurações genéricas padrão do sistema

            if (p.pdfSettings) {
              // 1. Proposta tem configurações próprias (prioridade máxima)
              const s = p.pdfSettings as PdfSettings;

              // We MUST set a template object because the render guard requires it
              const baseTemplate = ProposalDefaults.createDefaultTemplate(
                tenant.id,
                tenant.name,
                s.primaryColor || tenant.primaryColor || "#2563eb",
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

              if (s.logoStyle) setLogoStyle(s.logoStyle);

              if (s.coverImageOpacity !== undefined)
                setCoverImageOpacity(s.coverImageOpacity);
              if (s.coverImageFit) setCoverImageFit(s.coverImageFit);
              if (s.coverImagePosition)
                setCoverImagePosition(s.coverImagePosition);
              if (s.repeatHeader !== undefined) setRepeatHeader(s.repeatHeader);

              // Load sections
              if (s.sections && s.sections.length > 0) {
                // Hydrate saved sections to ensure dynamic text is up to date
                setSections(hydrateSections(s.sections as PdfSection[], p));
              } else {
                const t = ProposalDefaults.createDefaultTemplate(
                  tenant.id,
                  tenant.name,
                  s.primaryColor || tenant.primaryColor || "#2563eb",
                );
                // Override payment terms with dynamic ones
                t.paymentTerms = generatePaymentTerms(p);
                setSections(createDefaultSections(t, t.primaryColor));
              }

              // Load cover elements
              if (s.coverElements && s.coverElements.length > 0) {
                setCoverElements(s.coverElements);
              } else {
                setCoverElements(createDefaultCoverElements());
              }
            } else if (tenant.proposalDefaults) {
              // 2. No proposal-specific settings, but tenant has saved defaults
              const s = tenant.proposalDefaults as PdfSettings;

              const baseTemplate = ProposalDefaults.createDefaultTemplate(
                tenant.id,
                tenant.name,
                s.primaryColor || tenant.primaryColor || "#2563eb",
              );
              setTemplate(baseTemplate);

              // Load tenant default settings
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

              if (s.logoStyle) setLogoStyle(s.logoStyle);

              if (s.coverImageOpacity !== undefined)
                setCoverImageOpacity(s.coverImageOpacity);
              if (s.coverImageFit) setCoverImageFit(s.coverImageFit);
              if (s.coverImagePosition)
                setCoverImagePosition(s.coverImagePosition);
              if (s.repeatHeader !== undefined) setRepeatHeader(s.repeatHeader);

              // Load sections from tenant defaults
              if (s.sections && s.sections.length > 0) {
                // Hydrate tenant default sections
                setSections(hydrateSections(s.sections as PdfSection[], p));
              } else {
                // Inject dynamic payment terms into baseTemplate before creating sections
                const dynamicTemplate = {
                  ...baseTemplate,
                  paymentTerms: generatePaymentTerms(p),
                };
                setSections(
                  createDefaultSections(
                    dynamicTemplate,
                    dynamicTemplate.primaryColor,
                  ),
                );
              }

              // Load cover elements from tenant defaults
              if (s.coverElements && s.coverElements.length > 0) {
                setCoverElements(s.coverElements);
              } else {
                setCoverElements(createDefaultCoverElements());
              }
            } else {
              // 3. No saved settings at all, initialize from generic Defaults
              const t = ProposalDefaults.createDefaultTemplate(
                tenant.id,
                tenant.name,
                tenant.primaryColor || "#2563eb",
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

                setRepeatHeader(false);

                // Dynamic terms
                t.paymentTerms = generatePaymentTerms(p);
                setSections(createDefaultSections(t, t.primaryColor));
                setCoverElements(createDefaultCoverElements());
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, tenant?.id, canAccessPage, isPlanLoading]);

  const handleSave = async (optionsOrEvent?: unknown) => {
    const suppressToast =
      typeof optionsOrEvent === "object" &&
      optionsOrEvent !== null &&
      "suppressToast" in optionsOrEvent
        ? (optionsOrEvent as { suppressToast?: boolean }).suppressToast
        : false;

    const suppressLoading =
      typeof optionsOrEvent === "object" &&
      optionsOrEvent !== null &&
      "suppressLoading" in optionsOrEvent
        ? (optionsOrEvent as { suppressLoading?: boolean }).suppressLoading
        : false;

    if (!proposal || !template) return;
    if (!suppressLoading) setIsSaving(true);

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
        logoStyle,
        coverImageOpacity,
        coverImageFit,
        coverImagePosition,
        repeatHeader,
        sections,
        coverElements,
      };

      const sanitizedSettings = cleanForFirestore(settings);
      const payloadSize = JSON.stringify(sanitizedSettings).length;
      if (payloadSize > 950000) {
        alert(
          `O documento está muito grande (${Math.round(payloadSize / 1024)}KB). O limite do banco de dados é 1MB. Por favor, reduza o tamanho das imagens ou remova algumas.`,
        );
        setIsSaving(false);
        return;
      }

      // SALVA APENAS ESTA PROPOSTA ESPECÍFICA
      // Não altera configurações padrão do tenant ou de outras propostas
      await ProposalService.updateProposal(proposal.id, {
        title: coverTitle,
        pdfSettings: sanitizedSettings as Proposal["pdfSettings"],
      });

      if (!suppressToast) {
        toast.success("Proposta e personalizações salvas com sucesso!");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar");
    } finally {
      if (!suppressLoading) setIsSaving(false);
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
      container.style.width = `${PAGE_WIDTH_PX}px`;
      container.style.height = `${PAGE_HEIGHT_PX}px`;
      document.body.appendChild(container);

      try {
        for (let i = 0; i < pageElements.length; i++) {
          const originalPage = pageElements[i] as HTMLElement;
          const clonedPage = originalPage.cloneNode(true) as HTMLElement;

          clonedPage.style.transform = "none";
          clonedPage.style.margin = "0";
          clonedPage.style.boxShadow = "none";
          clonedPage.style.width = `${PAGE_WIDTH_PX}px`;
          clonedPage.style.height = `${PAGE_HEIGHT_PX}px`;

          container.innerHTML = "";
          container.appendChild(clonedPage);

          const canvas = await html2canvas(clonedPage, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            width: PAGE_WIDTH_PX,
            height: PAGE_HEIGHT_PX,
            windowWidth: PAGE_WIDTH_PX,
            windowHeight: PAGE_HEIGHT_PX,
            onclone: (clonedDoc) => {
              console.log("🔧 [PDF DEBUG] Starting onclone fixes...");

              const allElements = clonedDoc.querySelectorAll("*");
              allElements.forEach((el) => {
                const element = el as HTMLElement;
                const cs = window.getComputedStyle(element);

                const hasModernColor = (value: string) => {
                  return (
                    value &&
                    (value.includes("lab(") ||
                      value.includes("oklab(") ||
                      value.includes("lch(") ||
                      value.includes("oklch(") ||
                      value.includes("color("))
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

              // FIX 1: EXTRA TAG ALIGNMENT - Find by searching for the exact image
              console.log("🔧 [PDF DEBUG] Looking for EXTRA tag images...");
              const extraImages =
                clonedDoc.querySelectorAll('img[alt="EXTRA"]');
              console.log(
                `🔧 [PDF DEBUG] Found ${extraImages.length} EXTRA tag images`,
              );

              extraImages.forEach((img, index) => {
                console.log(
                  `🔧 [PDF DEBUG] Processing EXTRA image ${index + 1}`,
                );
                const imgEl = img as HTMLElement;
                const tdParent = imgEl.closest("td");
                const trParent = imgEl.closest("tr");

                if (tdParent && trParent) {
                  console.log(
                    `🔧 [PDF DEBUG] Found TD and TR parents for EXTRA ${index + 1}`,
                  );
                  // Force the entire row to have middle alignment
                  trParent.style.verticalAlign = "middle";

                  // Find all TDs in this row and force middle alignment
                  const allTdsInRow = trParent.querySelectorAll("td");
                  allTdsInRow.forEach((td) => {
                    const tdEl = td as HTMLElement;
                    tdEl.style.verticalAlign = "middle";
                    tdEl.style.lineHeight = "normal";
                  });

                  // Force the image itself
                  imgEl.style.verticalAlign = "middle";
                  imgEl.style.display = "block";
                  console.log(
                    `🔧 [PDF DEBUG] Applied middle alignment to EXTRA ${index + 1}`,
                  );
                } else {
                  console.log(
                    `🔧 [PDF DEBUG] WARNING: Could not find TD/TR parent for EXTRA ${index + 1}`,
                  );
                }
              });

              // FIX 2: SISTEMA TITLE SPACING - Find by looking for the spacer div
              console.log(
                "🔧 [PDF DEBUG] Looking for sistema title spacers...",
              );
              const spacerDivs = clonedDoc.querySelectorAll(
                'div[style*="height: 12px"]',
              );
              console.log(
                `🔧 [PDF DEBUG] Found ${spacerDivs.length} spacer divs`,
              );

              spacerDivs.forEach((div, index) => {
                const divEl = div as HTMLElement;
                console.log(`🔧 [PDF DEBUG] Processing spacer ${index + 1}`);
                // Force the spacer to be visible
                divEl.style.height = "12px";
                divEl.style.minHeight = "12px";
                divEl.style.display = "block";
                divEl.style.width = "100%";
                divEl.style.clear = "both";
                divEl.style.fontSize = "0";
                divEl.style.lineHeight = "0";
                // Add a non-breaking space to force it to occupy space
                if (!divEl.innerHTML || divEl.innerHTML.trim() === "") {
                  divEl.innerHTML = "&nbsp;";
                }
                console.log(
                  `🔧 [PDF DEBUG] Applied spacing to spacer ${index + 1}`,
                );
              });

              console.log("🔧 [PDF DEBUG] Onclone fixes completed");
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
        `proposta-${proposal?.title?.toLowerCase().replace(/\s+/g, "-") || "comercial"}.pdf`,
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
    logoStyle,
    setLogoStyle,
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

    // Cover Elements
    coverElements,
    setCoverElements,

    // Preview
    previewZoom,
    setPreviewZoom,

    // Actions
    handleSave,
    handleGeneratePdf,
    handleSaveDefault: async () => {
      if (!tenant || !proposal) return;
      setIsSavingDefault(true);
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
              if (typeof val === "function" || typeof val === "symbol")
                continue;
              newObj[key] = cleanForFirestore(val);
            }
          }
          return newObj;
        };

        const settings = {
          theme,
          primaryColor,
          fontFamily,
          // IMPORTANTE: coverTitle NÃO é salvo como padrão pois é específico de cada proposta
          coverImage,
          coverLogo,
          logoStyle,
          coverImageOpacity,
          coverImageFit,
          coverImagePosition,
          repeatHeader,
          sections,
          coverElements,
        };

        const sanitizedSettings = cleanForFirestore(settings);

        // PASSO 1: Salva as configurações como padrão no tenant
        // Essas configurações serão aplicadas automaticamente em NOVAS propostas criadas no futuro
        const { TenantService } = await import("@/services/tenant-service");
        await TenantService.updateTenant(tenant.id, {
          proposalDefaults: sanitizedSettings as Record<string, unknown>,
        });

        // PASSO 2: Salva as configurações na proposta ATUAL também (silenciosamente)
        // Isso garante que a proposta atual mantenha essas configurações específicas
        await handleSave({ suppressToast: true, suppressLoading: true });

        // PASSO 3: Atualiza o contexto do tenant no frontend
        // Isso faz com que novas propostas criadas nesta sessão já usem as novas configurações
        refreshTenant();

        toast.success("Configurações salvas como padrão para novas propostas!");
      } catch (error) {
        console.error("Error saving defaults:", error);
        toast.error("Erro ao salvar configurações padrão");
      } finally {
        setIsSavingDefault(false);
      }
    },
    isSavingDefault,
  };
}
