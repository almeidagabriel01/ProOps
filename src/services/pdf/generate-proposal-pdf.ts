import { Proposal } from "@/services/proposal-service";
import { ProposalTemplate, Tenant } from "@/types";
import { CoverElement, PdfSection } from "@/components/features/proposal/pdf-section-editor";
import { ThemeType } from "@/components/features/proposal/edit-pdf/pdf-theme-utils";
import { RenderToPdfResult } from "@/services/pdf/render-to-pdf";
import { renderProposalToPdfOffscreen } from "@/services/pdf/render-proposal-offscreen";
import { ProposalDefaults } from "@/lib/proposal-defaults";
import { ProposalService } from "@/services/proposal-service";

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

export interface GenerateProposalPdfOptions {
  proposal: Partial<Proposal>;
  template?: ProposalTemplate | null;
  tenant?: Tenant | null;
  customSettings?: ProposalPdfCustomSettings;
  showCover?: boolean;
  rootHint?: string;
  proposalTitle?: string;
  tenantId?: string;
  sourceLabel?: "download" | "view" | "edit-preview" | "shared";
  canonicalSource?: boolean;
}

export async function generateProposalPdf({
  proposal,
  template,
  tenant,
  customSettings,
  showCover = true,
  rootHint = "pdf-offscreen-content",
  proposalTitle,
  tenantId,
  sourceLabel = "download",
  canonicalSource = true,
}: GenerateProposalPdfOptions): Promise<RenderToPdfResult> {
  const hasProposalPayload = Boolean(
    proposal &&
      (proposal.id ||
        (proposal.products && proposal.products.length > 0) ||
        proposal.title),
  );

  if (!hasProposalPayload) {
    throw new Error("Proposal payload is required for unified PDF generation.");
  }

  let resolvedProposal = proposal;
  const shouldFetchCanonical =
    canonicalSource && sourceLabel !== "edit-preview" && Boolean(proposal.id);
  if (shouldFetchCanonical && proposal.id) {
    const latest = await ProposalService.getProposalById(proposal.id);
    if (latest) {
      resolvedProposal = { ...latest, ...proposal };
    }
  }

  // Canonical fallback to avoid section/style divergence across different entry points.
  const resolvedTemplate: ProposalTemplate | null =
    template ||
    (tenant
      ? ProposalDefaults.createDefaultTemplate(
          tenant.id,
          tenant.name,
          tenant.primaryColor || "#2563eb",
        )
      : null);

  return renderProposalToPdfOffscreen({
    proposal: resolvedProposal as Proposal,
    template: resolvedTemplate,
    tenant: tenant || null,
    customSettings,
    showCover,
    rootHint,
    proposalTitle: proposalTitle || resolvedProposal?.title,
    tenantId: tenantId || resolvedProposal?.tenantId,
    sourceLabel,
  });
}
