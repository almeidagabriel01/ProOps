import * as React from "react";
import { Proposal } from "@/services/proposal-service";
import type { Proposal as DomainProposal } from "@/types/proposal";
import {
  ProposalTemplate,
  Tenant,
  PdfDisplaySettings,
  mergePdfDisplaySettings,
} from "@/types";
import {
  PdfSection,
  CoverElement,
  createDefaultSections,
} from "@/components/features/proposal/pdf-section-editor";
import {
  ensureCanonicalSectionStructure,
  generatePaymentTerms,
  hydrateSections,
} from "@/components/features/proposal/edit-pdf/pdf-hydration-utils";
import { RenderPagedContent } from "@/components/pdf/render-paged-content";
import { useEnrichedProducts } from "@/components/features/proposal/pdf/use-enriched-products";
import { PdfCoverPage } from "@/components/features/proposal/pdf/pdf-cover-page";
import {
  getContentStyles,
  PdfThemeDecorations,
  ThemeType,
} from "@/components/features/proposal/edit-pdf/pdf-theme-utils";
import { normalizeCoverElements } from "@/components/features/proposal/pdf-section-editor";

interface ProposalPdfViewerProps {
  proposal: Proposal;
  template?: ProposalTemplate | null;
  tenant: Tenant | null;
  className?: string;
  showCover?: boolean;
  noMargins?: boolean;
  // Overrides for live preview
  customSettings?: {
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
  };
}

export function ProposalPdfViewer({
  proposal,
  template,
  tenant,
  customSettings,
  showCover = true,
}: ProposalPdfViewerProps) {
  const proposalData = proposal as unknown as DomainProposal;

  // Use enriched products hook (filter out inactive products for PDF)
  const { products } = useEnrichedProducts(proposal, tenant?.id, {
    filterInactive: true,
  });

  // Extract settings from proposal if not provided in customSettings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savedPdfSettings = proposal.pdfSettings as any;
  const savedSections = proposal.sections as unknown as PdfSection[];

  // Merge settings: Custom > Saved > Template > Defaults
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

  const fontFamily =
    customSettings?.fontFamily ||
    savedPdfSettings?.fontFamily ||
    template?.fontFamily ||
    "'Inter', sans-serif";

  const coverTitle =
    customSettings?.coverTitle ||
    savedPdfSettings?.coverTitle ||
    proposal.title ||
    "";

  // Cover Image Logic
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

  const savedCoverImageSettings = savedPdfSettings?.coverImageSettings || {};

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

  // Sections logic
  // Priority:
  // 1. Custom settings (Preview mode)
  // 2. Saved sections (if array with items) -> Means user customized it
  // 3. Default sections from template -> Default behavior

  let sectionsToUse: PdfSection[] = [];

  if (customSettings?.sections && customSettings.sections.length > 0) {
    sectionsToUse = hydrateSections(customSettings.sections, proposalData);
  } else if (Array.isArray(savedSections) && savedSections.length > 0) {
    sectionsToUse = hydrateSections(savedSections, proposalData);
  } else if (template) {
    const templateWithDynamicPaymentTerms = {
      ...template,
      paymentTerms: generatePaymentTerms(proposalData),
    };

    sectionsToUse = createDefaultSections(
      templateWithDynamicPaymentTerms,
      primaryColor,
    );
  }

  sectionsToUse = ensureCanonicalSectionStructure(sectionsToUse);

  const displaySections = sectionsToUse;

  // Compute styles based on theme
  const contentStyles = getContentStyles(theme, primaryColor);

  // Extract PDF display settings (for showing/hiding elements in PDF)
  const pdfDisplaySettings: PdfDisplaySettings =
    mergePdfDisplaySettings(savedPdfSettings);

  // Normalize cover elements to ensure backward compatibility
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
          proposal={proposal}
          fontFamily={fontFamily}
          coverElements={coverElements}
          logoStyle={
            customSettings?.logoStyle ||
            savedPdfSettings?.logoStyle ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (template as any)?.logoStyle
          }
          validUntil={proposal.validUntil}
        />
      )}
      <RenderPagedContent
        sections={displaySections}
        products={products}
        fontFamily={fontFamily}
        contentStyles={contentStyles}
        primaryColor={primaryColor}
        renderThemeDecorations={() => (
          <PdfThemeDecorations theme={theme} primaryColor={primaryColor} />
        )}
        tenant={tenant}
        coverTitle={coverTitle}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        proposal={proposal as any}
        repeatHeader={repeatHeader}
        pdfDisplaySettings={pdfDisplaySettings}
      />
    </>
  );
}
