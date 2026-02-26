"use client";

import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { flushSync } from "react-dom";
import { ProposalPdfViewer } from "@/components/pdf/proposal-pdf-viewer";
import { Proposal } from "@/services/proposal-service";
import { ProposalTemplate, Tenant } from "@/types";
import { ThemeType } from "@/components/features/proposal/edit-pdf/pdf-theme-utils";
import { RenderToPdfResult, renderToPdf } from "@/services/pdf/render-to-pdf";
import type { CoverElement, PdfSection } from "@/pdf/templates/ProposalPdfTemplate";

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

async function waitForElement(
  root: ParentNode,
  selector: string,
  timeoutMs = 2500,
): Promise<HTMLElement | null> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const found = root.querySelector<HTMLElement>(selector);
    if (found) return found;
    await waitForRaf();
  }
  return null;
}

async function waitForAttributeValue(
  root: ParentNode,
  selector: string,
  attributeName: string,
  expectedValue: string,
  timeoutMs = 5000,
): Promise<boolean> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const found = root.querySelector<HTMLElement>(selector);
    if (found?.getAttribute(attributeName) === expectedValue) {
      return true;
    }
    await waitForRaf();
  }
  return false;
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
    flushSync(() => {
      reactRoot?.render(
        <div
          id="pdf-offscreen-content"
          style={{ width: "794px", minWidth: "794px" }}
        >
          <ProposalPdfViewer
            proposal={proposal}
            template={template}
            tenant={tenant}
            customSettings={
              customSettings as Parameters<
                typeof ProposalPdfViewer
              >[0]["customSettings"]
            }
            showCover={showCover}
            skipCatalogEnrichment={sourceLabel === "shared"}
          />
        </div>,
      );
    });

    await waitForRaf();
    await waitForRaf();

    const rootElement = await waitForElement(host, "#pdf-offscreen-content");
    if (!rootElement) {
      throw new Error("Offscreen PDF root not found.");
    }
    await waitForAttributeValue(
      host,
      "[data-pdf-products-ready]",
      "data-pdf-products-ready",
      "1",
      6000,
    );
    await waitForRaf();
    await waitForRaf();

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
