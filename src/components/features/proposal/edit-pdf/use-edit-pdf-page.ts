"use client";

import {
  useState,
  useEffect,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { useTenant } from "@/providers/tenant-provider";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { ProposalService } from "@/services/proposal-service";
import { Proposal } from "@/types/proposal";
import { ProposalDefaults } from "@/lib/proposal-defaults";
import {
  PdfSection,
  CoverElement,
  createDefaultSections,
  createDefaultCoverElements,
  normalizeCoverElements,
} from "../pdf-section-editor";
import { ProposalTemplate } from "@/types";
import { ThemeType } from "./pdf-theme-utils";
import {
  DEFAULT_PAYMENT_TERMS_TEXT,
  generatePaymentTerms,
  hydrateSections,
} from "./pdf-hydration-utils";
import {
  DEFAULT_PDF_FONT_FAMILY,
  normalizePdfFontFamily,
} from "@/services/pdf/pdf-fonts";
import { downloadProposalPdfFromBackend } from "@/services/pdf/download-proposal-pdf";

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

function normalizeText(value?: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isLegacyPaymentTitle(section: PdfSection): boolean {
  if (section.type !== "title") return false;
  const content = normalizeText(section.content);
  return (
    content.includes("condicoes de pagamento") ||
    content.includes("condicao de pagamento") ||
    content.includes("formas de pagamento")
  );
}

function isLegacyPaymentText(section: PdfSection): boolean {
  if (section.type !== "text") return false;
  const content = normalizeText(section.content);
  return (
    content.includes("formas de pagamento") ||
    content.includes("pagamento a vista") ||
    content.includes("entrada:") ||
    content.includes("parcelamento:") ||
    content.includes("saldo:")
  );
}

function createPaymentTermsSection(): PdfSection {
  return {
    id: crypto.randomUUID(),
    type: "payment-terms",
    content: "Condições de Pagamento",
    columnWidth: 100,
    styles: {
      fontSize: "14px",
      fontWeight: "normal",
      textAlign: "left",
      color: "#374151",
      marginTop: "24px",
      marginBottom: "16px",
    },
  };
}

function hasDynamicPaymentOptions(proposal: Proposal | null): boolean {
  if (!proposal) return false;

  const downPaymentType = proposal.downPaymentType || "value";
  const downPaymentPercentage = proposal.downPaymentPercentage || 0;
  const downPaymentValue =
    downPaymentType === "percentage"
      ? ((proposal.totalValue || 0) * downPaymentPercentage) / 100
      : proposal.downPaymentValue || 0;

  const hasDownPayment = proposal.downPaymentEnabled && downPaymentValue > 0;
  const hasInstallments =
    !!proposal.installmentsEnabled && (proposal.installmentsCount || 0) >= 1;

  return hasDownPayment || hasInstallments;
}

function normalizePaymentSections(
  sections: PdfSection[],
  proposal: Proposal | null,
): PdfSection[] {
  const dynamicPayment = hasDynamicPaymentOptions(proposal);
  const paymentTextContent = proposal
    ? generatePaymentTerms(proposal)
    : DEFAULT_PAYMENT_TERMS_TEXT;

  const hasPaymentTerms = sections.some((section) => section.type === "payment-terms");
  const hasLegacy = sections.some(
    (section) => isLegacyPaymentTitle(section) || isLegacyPaymentText(section),
  );

  if (!hasPaymentTerms && !hasLegacy) {
    if (!dynamicPayment) return sections;
    return [...sections, createPaymentTermsSection()];
  }

  if (!dynamicPayment) {
    let firstPaymentSection: PdfSection | null = null;
    let firstPaymentIndex = -1;
    const baseSections: PdfSection[] = [];

    sections.forEach((section, index) => {
      const isLegacy =
        isLegacyPaymentTitle(section) || isLegacyPaymentText(section);
      const isPaymentTerms = section.type === "payment-terms";

      if (isLegacy || isPaymentTerms) {
        if (firstPaymentIndex === -1) {
          firstPaymentIndex = index;
        }

        if (!firstPaymentSection) {
          firstPaymentSection = isPaymentTerms
            ? {
                ...section,
                columnWidth: 100,
                content: section.content || paymentTextContent,
              }
            : createPaymentTermsSection();
        }

        if (
          firstPaymentSection &&
          isLegacyPaymentText(section) &&
          section.content?.trim()
        ) {
          firstPaymentSection = {
            ...firstPaymentSection,
            content: section.content,
          };
        }
        return;
      }

      baseSections.push(section);
    });

    if (firstPaymentIndex === -1) {
      return sections;
    }

    const paymentSectionBase: PdfSection =
      firstPaymentSection ?? createPaymentTermsSection();
    const paymentSection: PdfSection = {
      ...paymentSectionBase,
      columnWidth: 100,
      content: paymentSectionBase.content || paymentTextContent,
    };

    const insertIndex = sections
      .slice(0, firstPaymentIndex)
      .filter(
        (section) =>
          section.type !== "payment-terms" &&
          !isLegacyPaymentTitle(section) &&
          !isLegacyPaymentText(section),
      ).length;

    return [
      ...baseSections.slice(0, insertIndex),
      paymentSection,
      ...baseSections.slice(insertIndex),
    ];
  }

  let firstPaymentSection: PdfSection | null = null;
  let firstPaymentIndex = -1;
  const baseSections: PdfSection[] = [];

  sections.forEach((section, index) => {
    const isLegacy =
      isLegacyPaymentTitle(section) || isLegacyPaymentText(section);
    const isPaymentTerms = section.type === "payment-terms";

    if (isLegacy || isPaymentTerms) {
      if (!firstPaymentSection) {
        firstPaymentSection = isPaymentTerms
          ? {
              ...section,
              content: "Condições de Pagamento",
              columnWidth: 100,
            }
          : createPaymentTermsSection();
        firstPaymentIndex = index;
      }
      return;
    }

    baseSections.push(section);
  });

  const paymentSection = firstPaymentSection || createPaymentTermsSection();

  if (firstPaymentIndex === -1) {
    return [...baseSections, paymentSection];
  }

  const insertIndex = sections
    .slice(0, firstPaymentIndex)
    .filter(
      (section) =>
        section.type !== "payment-terms" &&
        !isLegacyPaymentTitle(section) &&
        !isLegacyPaymentText(section),
    ).length;

  return [
    ...baseSections.slice(0, insertIndex),
    paymentSection,
    ...baseSections.slice(insertIndex),
  ];
}

export function cleanForFirestore(obj: unknown): unknown {
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
  const [fontFamily, setFontFamily] = useState<string>(DEFAULT_PDF_FONT_FAMILY);

  // Editable sections
  const [sections, setSections] = useState<PdfSection[]>([]);
  const setSectionsNormalized = useCallback<Dispatch<SetStateAction<PdfSection[]>>>(
    (value) => {
    setSections((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      return normalizePaymentSections(next, proposal);
    });
    },
    [proposal],
  );
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

  // Unsaved changes tracking
  const [initialSettingsJson, setInitialSettingsJson] = useState<string | null>(null);

  const currentSettingsObj = {
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

  const currentSettingsJson = JSON.stringify(cleanForFirestore(currentSettingsObj));

  useEffect(() => {
    if (!isLoading && initialSettingsJson === null) {
      const timer = setTimeout(() => {
        setInitialSettingsJson(currentSettingsJson);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, initialSettingsJson, currentSettingsJson]);

  const isDirty = initialSettingsJson !== null && currentSettingsJson !== initialSettingsJson;


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
                productImage: prod.productImage || "",
                productImages:
                  prod.productImages && prod.productImages.length > 0
                    ? prod.productImages
                    : prod.productImage
                      ? [prod.productImage]
                      : [],
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
              if (s.fontFamily)
                setFontFamily(normalizePdfFontFamily(s.fontFamily));
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
                setSections(
                  normalizePaymentSections(
                    hydrateSections(s.sections as PdfSection[], p),
                    p,
                  ),
                );
              } else {
                const t = ProposalDefaults.createDefaultTemplate(
                  tenant.id,
                  tenant.name,
                  s.primaryColor || tenant.primaryColor || "#2563eb",
                );
                // Override payment terms with dynamic ones
                t.paymentTerms = generatePaymentTerms(p);
                setSections(
                  normalizePaymentSections(
                    createDefaultSections(t, t.primaryColor),
                    p,
                  ),
                );
              }

              // Load cover elements
              if (s.coverElements && s.coverElements.length > 0) {
                setCoverElements(normalizeCoverElements(s.coverElements));
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
              if (s.fontFamily)
                setFontFamily(normalizePdfFontFamily(s.fontFamily));
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
                setSections(
                  normalizePaymentSections(
                    hydrateSections(s.sections as PdfSection[], p),
                    p,
                  ),
                );
              } else {
                // Inject dynamic payment terms into baseTemplate before creating sections
                const dynamicTemplate = {
                  ...baseTemplate,
                  paymentTerms: generatePaymentTerms(p),
                };
                setSections(
                  normalizePaymentSections(
                    createDefaultSections(
                      dynamicTemplate,
                      dynamicTemplate.primaryColor,
                    ),
                    p,
                  ),
                );
              }

              // Load cover elements from tenant defaults
              if (s.coverElements && s.coverElements.length > 0) {
                setCoverElements(normalizeCoverElements(s.coverElements));
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
                setFontFamily(normalizePdfFontFamily(t.fontFamily));
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
                setSections(
                  normalizePaymentSections(
                    createDefaultSections(t, t.primaryColor),
                    p,
                  ),
                );
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
      const sanitizedSettings = cleanForFirestore(currentSettingsObj);
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

      setInitialSettingsJson(JSON.stringify(sanitizedSettings));

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
      // 1. Save current settings so the backend sees the latest customizations
      await handleSave({ suppressToast: true, suppressLoading: true });

      // 2. Download via the centralized backend Playwright pipeline
      await downloadProposalPdfFromBackend(proposal!.id, proposal!.title);
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
    setSections: setSectionsNormalized,
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

    // Unsaved Changes
    isDirty,

    // Actions
    handleSave,
    handleGeneratePdf,
    handleSaveDefault: async () => {
      if (!tenant || !proposal) return;
      setIsSavingDefault(true);
      try {
        const sanitizedSettings = cleanForFirestore(currentSettingsObj);

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

