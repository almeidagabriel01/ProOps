"use client";

import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import { Proposal } from "@/services/proposal-service";
import { ProposalTemplate, Tenant } from "@/types";
import { CoverElement, PdfSection } from "@/components/features/proposal/pdf-section-editor";
import { ThemeType } from "@/components/features/proposal/edit-pdf/pdf-theme-utils";
import { RenderToPdfResult, renderToPdf } from "@/services/pdf/render-to-pdf";

interface OffscreenViewerSettings {
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

interface RenderProposalToPdfOffscreenOptions {
  proposal: Proposal;
  template?: ProposalTemplate | null;
  tenant: Tenant | null;
  customSettings?: OffscreenViewerSettings;
  showCover?: boolean;
  rootHint?: string;
  proposalTitle?: string;
  tenantId?: string;
  sourceLabel?: "download" | "view" | "edit-preview" | "shared";
}

function waitForRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export async function renderProposalToPdfOffscreen({
  proposal,
  template,
  tenant,
  customSettings,
  showCover = true,
  rootHint = "pdf-capture-root",
  proposalTitle,
  tenantId,
  sourceLabel = "download",
}: RenderProposalToPdfOffscreenOptions): Promise<RenderToPdfResult> {
  const host = document.createElement("div");
  host.id = "pdf-capture-root";
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.transform = "translateX(-200vw)";
  host.style.width = "794px";
  host.style.opacity = "0.01";
  host.style.pointerEvents = "none";
  host.style.overflow = "hidden";
  host.style.backgroundColor = "#ffffff";
  document.body.appendChild(host);

  let reactRoot: Root | null = null;
  try {
    reactRoot = createRoot(host);
    reactRoot.render(
      <div id="pdf-offscreen-content" style={{ width: "794px", minWidth: "794px" }}>
        <ProposalPdfViewer
          proposal={proposal}
          template={template}
          tenant={tenant}
          customSettings={
            customSettings as Parameters<typeof ProposalPdfViewer>[0]["customSettings"]
          }
          showCover={showCover}
        />
      </div>,
    );

    await waitForRaf();
    await waitForRaf();

    const rootElement = host.querySelector<HTMLElement>("#pdf-offscreen-content");
    if (!rootElement) {
      throw new Error("Offscreen PDF root not found.");
    }

    return await renderToPdf({
      rootElement,
      rootHint,
      proposalTitle: proposalTitle || proposal.title,
      tenantId: tenantId || proposal.tenantId,
      sourceLabel,
    });
  } finally {
    reactRoot?.unmount();
    if (document.body.contains(host)) {
      document.body.removeChild(host);
    }
  }
}
