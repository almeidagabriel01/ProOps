import * as React from "react";
import { Proposal } from "@/services/proposal-service";
import { ProposalTemplate, Tenant } from "@/types";
import {
  PdfSection,
  CoverElement,
  createDefaultSections,
} from "@/components/features/proposal/pdf-section-editor";
import { RenderPagedContent } from "@/components/pdf/render-paged-content";
import { useEnrichedProducts } from "@/components/features/proposal/pdf/use-enriched-products";
import { PdfCoverPage } from "@/components/features/proposal/pdf/pdf-cover-page";
import {
  getContentStyles,
  PdfThemeDecorations,
  ThemeType,
} from "@/components/features/proposal/edit-pdf/pdf-theme-utils";

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
  className,
  showCover = true,
  noMargins = false,
}: ProposalPdfViewerProps) {
  // Use enriched products hook (filter out inactive products for PDF)
  const { products } = useEnrichedProducts(proposal, tenant?.id, {
    filterInactive: true,
  });

  // Merge settings: Custom > Template > Defaults
  const theme =
    customSettings?.theme || (template?.theme as ThemeType) || "modern";
  const primaryColor =
    customSettings?.primaryColor ||
    template?.primaryColor ||
    tenant?.primaryColor ||
    "#2563eb";
  const fontFamily =
    customSettings?.fontFamily || template?.fontFamily || "'Inter', sans-serif";
  const coverTitle = customSettings?.coverTitle || proposal.title || "";

  // Cover Image Logic
  const coverImage =
    customSettings?.coverImage !== undefined
      ? customSettings.coverImage
      : template?.coverImage || "";

  const coverLogo =
    customSettings?.coverLogo !== undefined
      ? customSettings.coverLogo
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
  const coverImageOpacity =
    customSettings?.coverImageOpacity ?? templateSettings.opacity ?? 30;
  const coverImageFit =
    customSettings?.coverImageFit ?? templateSettings.fit ?? "cover";
  const coverImagePosition =
    customSettings?.coverImagePosition ?? templateSettings.position ?? "center";

  const repeatHeader =
    customSettings?.repeatHeader ?? template?.repeatHeader ?? false;

  // If custom sections provided (preview mode), use them
  // Otherwise, generate from template (view mode) - simulating what edit page does
  const displaySections =
    customSettings?.sections ||
    (template ? createDefaultSections(template, primaryColor) : []);

  // Compute styles based on theme
  const contentStyles = getContentStyles(theme, primaryColor);

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
          coverElements={customSettings?.coverElements}
          logoStyle={customSettings?.logoStyle || (template as any)?.logoStyle}
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
      />
    </>
  );
}
