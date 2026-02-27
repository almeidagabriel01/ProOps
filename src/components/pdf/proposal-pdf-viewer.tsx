import * as React from "react";
import { Proposal } from "@/services/proposal-service";
import { ProposalTemplate, Tenant } from "@/types";
import { useEnrichedProducts } from "@/components/features/proposal/pdf/use-enriched-products";
import {
  ProposalPdfTemplate,
  type ProposalPdfCustomSettings,
} from "@/components/pdf/templates/ProposalPdfTemplate";

interface ProposalPdfViewerProps {
  proposal: Proposal;
  template?: ProposalTemplate | null;
  tenant: Tenant | null;
  className?: string;
  showCover?: boolean;
  noMargins?: boolean;
  skipCatalogEnrichment?: boolean;
  customSettings?: ProposalPdfCustomSettings;
}

export function ProposalPdfViewer({
  proposal,
  template,
  tenant,
  customSettings,
  showCover = true,
  skipCatalogEnrichment = false,
}: ProposalPdfViewerProps) {
  const { products, isLoading } = useEnrichedProducts(proposal, tenant?.id, {
    filterInactive: true,
    skipCatalogEnrichment,
  });

  return (
    <>
      <span
        data-pdf-products-ready={isLoading ? "0" : "1"}
        style={{ display: "none" }}
      />
      <ProposalPdfTemplate
        proposal={proposal}
        template={template}
        tenant={tenant}
        customSettings={customSettings}
        showCover={showCover}
        products={products}
      />
    </>
  );
}
