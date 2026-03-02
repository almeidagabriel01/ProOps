import * as React from "react";
import type {
  Proposal as DomainProposal,
  ProposalProduct,
} from "@/types/proposal";
import type { ProposalTemplate, Tenant, PdfDisplaySettings } from "@/types";
import { mergePdfDisplaySettings } from "@/types";
import { RenderPagedContent } from "@/components/pdf/render-paged-content";
import { PdfCoverPage } from "@/components/pdf/pdf-cover-page";
import {
  getContentStyles,
  PdfThemeDecorations,
  type ThemeType,
} from "@/components/features/proposal/edit-pdf/pdf-theme-utils";
import {
  DEFAULT_PDF_FONT_FAMILY,
  normalizePdfFontFamily,
} from "@/services/pdf/pdf-fonts";
import type { PdfSection, CoverElement } from "@/types/pdf.types";

// Re-exportados para retrocompatibilidade com importadores existentes.
export type {
  PdfSection,
  CoverElement,
  CoverElementPosition,
} from "@/types/pdf.types";

export interface ProposalPdfCustomSettings {
  theme?: ThemeType;
  primaryColor?: string;
  fontFamily?: string;
  coverTitle?: string;
  coverImage?: string;
  coverLogo?: string;
  coverImageOpacity?: number;
  coverImageFit?: "cover" | "contain";
  coverImagePosition?: string;
  sections?: PdfSection[];
  coverElements?: CoverElement[];
  repeatHeader?: boolean;
  pageNumberStart?: number;
  logoStyle?: "original" | "rounded" | "circle";
}

export interface ProposalPdfTemplateProps {
  proposal: DomainProposal;
  template?: ProposalTemplate | null;
  tenant: Tenant | null;
  showCover?: boolean;
  customSettings?: ProposalPdfCustomSettings;
  products?: ProposalProduct[];
  enforceCanonicalStructure?: boolean;
}

function createRuntimeId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultSections(
  template: {
    introductionText: string;
    scopeText: string;
    paymentTerms: string;
    warrantyText: string;
    footerText: string;
  },
  primaryColor: string,
): PdfSection[] {
  const sections: PdfSection[] = [];

  if (template.introductionText) {
    sections.push({
      id: createRuntimeId(),
      type: "text",
      content: template.introductionText,
      styles: { fontSize: "14px", color: "#374151", marginBottom: "16px" },
    });
  }

  if (template.scopeText) {
    sections.push({
      id: createRuntimeId(),
      type: "title",
      content: "Escopo do Projeto",
      styles: {
        fontSize: "20px",
        fontWeight: "bold",
        color: primaryColor,
        marginTop: "24px",
        marginBottom: "8px",
      },
    });
    sections.push({
      id: createRuntimeId(),
      type: "text",
      content: template.scopeText,
      styles: { fontSize: "14px", color: "#374151", marginBottom: "16px" },
    });
  }

  sections.push({
    id: createRuntimeId(),
    type: "product-table",
    content: "Sistemas / Ambientes / Produtos",
    columnWidth: 100,
    styles: {
      fontSize: "14px",
      color: "#374151",
      marginTop: "16px",
      marginBottom: "16px",
    },
  });

  if (template.paymentTerms) {
    sections.push({
      id: createRuntimeId(),
      type: "payment-terms",
      content: "Condicoes de Pagamento",
      columnWidth: 100,
      styles: {
        fontSize: "14px",
        fontWeight: "normal",
        textAlign: "left",
        color: "#374151",
        marginTop: "24px",
        marginBottom: "16px",
      },
    });
  }

  if (template.warrantyText) {
    sections.push({
      id: createRuntimeId(),
      type: "title",
      content: "Garantia",
      styles: {
        fontSize: "20px",
        fontWeight: "bold",
        color: primaryColor,
        marginTop: "24px",
        marginBottom: "8px",
      },
    });
    sections.push({
      id: createRuntimeId(),
      type: "text",
      content: template.warrantyText,
      styles: { fontSize: "14px", color: "#374151", marginBottom: "16px" },
    });
  }

  if (template.footerText) {
    sections.push({
      id: createRuntimeId(),
      type: "divider",
      content: "",
      styles: { marginTop: "32px", marginBottom: "16px" },
    });
    sections.push({
      id: createRuntimeId(),
      type: "text",
      content: template.footerText,
      styles: { fontSize: "14px", color: "#374151" },
    });
  }

  return sections;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");
}

function isPaymentTitle(section: PdfSection): boolean {
  if (section.type !== "title") return false;
  const content = normalizeText(section.content);
  return (
    content.includes("condicoes de pagamento") ||
    content.includes("condicao de pagamento") ||
    content.includes("formas de pagamento")
  );
}

function isPaymentText(section: PdfSection): boolean {
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

function isWarrantyTitle(section: PdfSection): boolean {
  return (
    section.type === "title" && normalizeText(section.content) === "garantia"
  );
}

function isWarrantyText(section: PdfSection): boolean {
  return (
    section.type === "text" &&
    normalizeText(section.content).includes("garantia")
  );
}

function isFooterText(section: PdfSection): boolean {
  return (
    section.type === "text" &&
    normalizeText(section.content).includes("atenciosamente")
  );
}

function ensureCanonicalSectionStructure(sections: PdfSection[]): PdfSection[] {
  const firstProductTable = sections.find(
    (section) => section.type === "product-table",
  ) || {
    id: createRuntimeId(),
    type: "product-table" as const,
    content: "Sistemas / Ambientes / Produtos",
    columnWidth: 100,
    styles: {
      fontSize: "14px",
      color: "#374151",
      marginTop: "16px",
      marginBottom: "16px",
    },
  };

  const withoutProductTables = sections.filter(
    (section) => section.type !== "product-table",
  );
  const insertionIndex = withoutProductTables.findIndex((section) => {
    if (isPaymentTitle(section) || isPaymentText(section)) return true;
    if (isWarrantyTitle(section) || isWarrantyText(section)) return true;
    if (isFooterText(section)) return true;
    return normalizeText(section.content || "").includes("atenciosamente");
  });

  const withSingleProductTable =
    insertionIndex === -1
      ? [...withoutProductTables, firstProductTable]
      : [
          ...withoutProductTables.slice(0, insertionIndex),
          firstProductTable,
          ...withoutProductTables.slice(insertionIndex),
        ];

  const fixedIds = new Set<string>();
  const paymentBlock: PdfSection[] = [];
  const warrantyBlock: PdfSection[] = [];
  const footerBlock: PdfSection[] = [];

  withSingleProductTable.forEach((section, index) => {
    if (isPaymentTitle(section) || isPaymentText(section)) {
      paymentBlock.push(section);
      fixedIds.add(section.id);
      return;
    }

    if (isWarrantyTitle(section) || isWarrantyText(section)) {
      warrantyBlock.push(section);
      fixedIds.add(section.id);
      return;
    }

    if (isFooterText(section)) {
      const previous =
        index > 0 ? withSingleProductTable[index - 1] : undefined;
      if (previous?.type === "divider" && !fixedIds.has(previous.id)) {
        footerBlock.push(previous);
        fixedIds.add(previous.id);
      }
      footerBlock.push(section);
      fixedIds.add(section.id);
    }
  });

  const baseSections = withSingleProductTable.filter(
    (section) => !fixedIds.has(section.id),
  );
  const lastProductTableIndex = baseSections
    .map((section) => section.type)
    .lastIndexOf("product-table");
  if (lastProductTableIndex === -1) {
    return withSingleProductTable;
  }

  const normalized = [...baseSections];
  normalized.splice(
    lastProductTableIndex + 1,
    0,
    ...paymentBlock,
    ...warrantyBlock,
    ...footerBlock,
  );
  return normalized;
}

function generatePaymentTerms(proposal: DomainProposal): string {
  const lines: string[] = [];
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const downPaymentType = proposal.downPaymentType || "value";
  const downPaymentPercentage = proposal.downPaymentPercentage || 0;
  const downPaymentValue =
    downPaymentType === "percentage"
      ? ((proposal.totalValue || 0) * downPaymentPercentage) / 100
      : proposal.downPaymentValue || 0;

  if (proposal.downPaymentEnabled && downPaymentValue > 0) {
    const total = proposal.totalValue || 0;
    const percentage =
      total > 0 ? Math.round((downPaymentValue / total) * 100) : 0;
    lines.push(
      `- Entrada: ${formatCurrency(downPaymentValue)} (${percentage}%) na aprovacao`,
    );
  }

  if (
    proposal.installmentsEnabled &&
    (proposal.installmentsCount || 0) > 0 &&
    (proposal.installmentValue || 0) > 0
  ) {
    lines.push(
      `- Parcelamento: ${proposal.installmentsCount}x de ${formatCurrency(proposal.installmentValue || 0)}`,
    );
  } else if (proposal.downPaymentEnabled && downPaymentValue > 0) {
    lines.push("- Saldo: na entrega");
  } else {
    lines.push("- Pagamento a vista na entrega");
  }

  lines.push("- Formas de pagamento: PIX, boleto ou cartao");
  return lines.join("\n");
}

function hydrateSections(
  sections: PdfSection[],
  proposal: DomainProposal,
  enforceCanonicalStructure: boolean,
): PdfSection[] {
  const paymentTerms = generatePaymentTerms(proposal);
  const hasDynamicPaymentOptions = !!(
    (proposal.installmentsEnabled &&
      (proposal.installmentsCount || 0) >= 1 &&
      (proposal.installmentValue || 0) > 0) ||
    (proposal.downPaymentEnabled &&
      (proposal.downPaymentType === "percentage"
        ? ((proposal.totalValue || 0) * (proposal.downPaymentPercentage || 0)) /
          100
        : proposal.downPaymentValue || 0) > 0)
  );
  const hydrated = sections.map((section) => {
    if (section.type === "payment-terms") {
      return {
        ...section,
        content: hasDynamicPaymentOptions
          ? "Condicoes de Pagamento"
          : section.content || paymentTerms,
        columnWidth: 100,
      };
    }

    if (section.type !== "text") {
      return section;
    }
    const normalizedContent = normalizeText(section.content || "");
    const isPaymentSection =
      normalizedContent.includes("formas de pagamento") ||
      normalizedContent.includes("entrada:") ||
      normalizedContent.includes("parcelamento:") ||
      normalizedContent.includes("pagamento a vista");
    return isPaymentSection ? { ...section, content: paymentTerms } : section;
  });

  return enforceCanonicalStructure
    ? ensureCanonicalSectionStructure(hydrated)
    : hydrated;
}

function normalizeCoverElements(elements: CoverElement[]): CoverElement[] {
  if (!elements || elements.length === 0) {
    return elements;
  }

  const hasLegacyTypes = elements.some(
    (element) =>
      (element.type === "title" && !element.content) ||
      (element.type === "text" && element.content?.includes("Preparado")),
  );

  const normalized = elements.map((element) => {
    if (element.type === "title" && !element.content) {
      return {
        ...element,
        type: "proposal-title" as const,
        prefix: element.prefix || "",
        suffix: element.suffix || "",
      };
    }
    if (element.type === "text" && element.content?.includes("Preparado")) {
      return {
        ...element,
        type: "client-name" as const,
        content: "",
        prefix: element.content || "Preparado para",
        suffix: element.suffix || "",
      };
    }
    return element;
  });

  const hasValidUntil = normalized.some(
    (element) => element.type === "valid-until",
  );
  if (hasLegacyTypes && !hasValidUntil) {
    const maxOrder = Math.max(0, ...normalized.map((element) => element.order));
    normalized.push({
      id: createRuntimeId(),
      type: "valid-until",
      content: "",
      prefix: "Valido ate",
      suffix: "",
      x: 50,
      y: 90,
      order: maxOrder + 1,
      styles: {
        fontSize: "18px",
        fontWeight: "600",
        color: "#ffffff",
        textAlign: "center",
      },
    });
  }

  return normalized;
}

function normalizeProposalProducts(
  products: ProposalProduct[],
): ProposalProduct[] {
  return products.map((product) => {
    const quantity = Number(product.quantity || 0);
    const normalizedImages = Array.isArray(product.productImages)
      ? product.productImages.filter(
          (image) => typeof image === "string" && image.trim(),
        )
      : [];
    const fallbackImage =
      product.productImage?.trim() || normalizedImages[0] || "";
    const isGhost = quantity <= 0;
    const isInactive = product.status === "inactive";

    return {
      ...product,
      quantity,
      productImage: fallbackImage,
      productImages:
        normalizedImages.length > 0
          ? normalizedImages
          : fallbackImage
            ? [fallbackImage]
            : [],
      _isInactive: isInactive,
      _isGhost: isGhost,
      _shouldHide: Boolean(product._shouldHide || isGhost || isInactive),
    };
  });
}

export function ProposalPdfTemplate({
  proposal,
  template,
  tenant,
  showCover = true,
  customSettings,
  products,
  enforceCanonicalStructure = true,
}: ProposalPdfTemplateProps) {
  const proposalData = proposal as DomainProposal;
  const normalizedProducts = normalizeProposalProducts(
    products || proposalData.products || [],
  );

  const savedPdfSettings = proposal.pdfSettings as
    | ProposalPdfCustomSettings
    | undefined;
  const savedSections =
    (savedPdfSettings?.sections as unknown as PdfSection[]) || [];

  const theme =
    customSettings?.theme ||
    savedPdfSettings?.theme ||
    (template?.theme as ThemeType) ||
    "modern";

  const primaryColor =
    customSettings?.primaryColor ||
    savedPdfSettings?.primaryColor ||
    template?.primaryColor ||
    tenant?.primaryColor ||
    "#2563eb";

  const fontFamily = normalizePdfFontFamily(
    customSettings?.fontFamily ||
      savedPdfSettings?.fontFamily ||
      template?.fontFamily ||
      DEFAULT_PDF_FONT_FAMILY,
  );

  const coverTitle =
    customSettings?.coverTitle ||
    savedPdfSettings?.coverTitle ||
    proposal.title ||
    "";
  const coverImage =
    customSettings?.coverImage !== undefined
      ? customSettings.coverImage
      : savedPdfSettings?.coverImage !== undefined
        ? savedPdfSettings.coverImage
        : template?.coverImage || "";

  const coverLogo =
    customSettings?.coverLogo !== undefined
      ? customSettings.coverLogo
      : savedPdfSettings?.coverLogo !== undefined
        ? savedPdfSettings.coverLogo
        : (template as ProposalTemplate & { coverLogo?: string })?.coverLogo ||
          tenant?.logoUrl ||
          "";

  const templateSettings =
    (
      template as ProposalTemplate & {
        coverImageSettings?: {
          opacity?: number;
          fit?: "cover" | "contain";
          position?: string;
        };
      }
    )?.coverImageSettings || {};

  const savedCoverImageSettings =
    (
      savedPdfSettings as ProposalPdfCustomSettings & {
        coverImageSettings?: {
          opacity?: number;
          fit?: "cover" | "contain";
          position?: string;
        };
      }
    )?.coverImageSettings || {};

  const coverImageOpacity =
    customSettings?.coverImageOpacity ??
    savedCoverImageSettings.opacity ??
    savedPdfSettings?.coverImageOpacity ??
    templateSettings.opacity ??
    30;

  const coverImageFit =
    customSettings?.coverImageFit ??
    savedCoverImageSettings.fit ??
    savedPdfSettings?.coverImageFit ??
    templateSettings.fit ??
    "cover";

  const coverImagePosition =
    customSettings?.coverImagePosition ??
    savedCoverImageSettings.position ??
    savedPdfSettings?.coverImagePosition ??
    templateSettings.position ??
    "center";

  const repeatHeader =
    customSettings?.repeatHeader ??
    savedPdfSettings?.repeatHeader ??
    template?.repeatHeader ??
    false;

  let sectionsToUse: PdfSection[] = [];
  let sectionsSource: "custom" | "saved" | "template" | "none" = "none";

  if (customSettings?.sections && customSettings.sections.length > 0) {
    sectionsSource = "custom";
    sectionsToUse = hydrateSections(
      customSettings.sections,
      proposalData,
      false,
    );
  } else if (Array.isArray(savedSections) && savedSections.length > 0) {
    sectionsSource = "saved";
    sectionsToUse = hydrateSections(savedSections, proposalData, false);
  } else if (template) {
    sectionsSource = "template";
    const templateWithDynamicPaymentTerms = {
      ...template,
      paymentTerms: generatePaymentTerms(proposalData),
    };
    sectionsToUse = createDefaultSections(
      templateWithDynamicPaymentTerms,
      primaryColor,
    );
  }

  const shouldEnforceCanonical =
    enforceCanonicalStructure && sectionsSource === "template";

  if (shouldEnforceCanonical) {
    sectionsToUse = ensureCanonicalSectionStructure(sectionsToUse);
  }

  const contentStyles = getContentStyles(theme, primaryColor);
  const pdfDisplaySettings: PdfDisplaySettings = mergePdfDisplaySettings(
    savedPdfSettings as unknown as Record<string, unknown>,
  );
  const coverElements = normalizeCoverElements(
    customSettings?.coverElements || savedPdfSettings?.coverElements || [],
  );

  return (
    <>
      {showCover && (
        <PdfCoverPage
          theme={theme}
          primaryColor={primaryColor}
          coverImage={coverImage}
          coverImageOpacity={coverImageOpacity}
          coverImageFit={coverImageFit}
          coverImagePosition={coverImagePosition}
          coverLogo={coverLogo}
          tenant={tenant}
          coverTitle={coverTitle}
          proposal={proposalData}
          fontFamily={fontFamily}
          coverElements={coverElements}
          logoStyle={
            customSettings?.logoStyle ||
            savedPdfSettings?.logoStyle ||
            (
              template as ProposalTemplate & {
                logoStyle?: "original" | "rounded" | "circle";
              }
            )?.logoStyle
          }
          validUntil={proposal.validUntil}
        />
      )}
      <RenderPagedContent
        sections={sectionsToUse}
        products={normalizedProducts}
        fontFamily={fontFamily}
        contentStyles={contentStyles}
        primaryColor={primaryColor}
        renderThemeDecorations={() => (
          <PdfThemeDecorations theme={theme} primaryColor={primaryColor} />
        )}
        tenant={tenant}
        coverTitle={coverTitle}
        proposal={
          proposalData as unknown as Parameters<
            typeof RenderPagedContent
          >[0]["proposal"]
        }
        repeatHeader={repeatHeader}
        pdfDisplaySettings={pdfDisplaySettings}
      />
    </>
  );
}
