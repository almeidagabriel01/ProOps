import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { chromium } from "playwright-core";
import chromiumPackage from "@sparticuz/chromium";
import { db } from "../../init";
import { SharedProposalService } from "./shared-proposal.service";

const PDF_TEMPLATE_VERSION = "proposal-pdf-v1";
const PDF_VIEWPORT_WIDTH = 1280;
const PDF_VIEWPORT_HEIGHT = 1700;
const PDF_PAGE_READY_TIMEOUT_MS = 45_000;

type ProposalPdfMetadata = {
  storagePath?: string;
  versionHash?: string;
};

type ProposalDocData = {
  tenantId?: unknown;
  pdf?: ProposalPdfMetadata;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
};

type TenantDocData = {
  name?: unknown;
  primaryColor?: unknown;
  logoUrl?: unknown;
  proposalDefaults?: unknown;
  [key: string]: unknown;
};

type SharedProposalPayload = {
  success: true;
  proposal: Record<string, unknown>;
  tenant: {
    id: string;
    name: string;
    logoUrl: string;
    primaryColor: string;
  } | null;
};

function getProposalPdfStoragePath(tenantId: string, proposalId: string): string {
  return `tenants/${tenantId}/proposals/${proposalId}/pdf/proposal.pdf`;
}

function toSerializable(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item));
  }
  if (typeof value === "object") {
    if (
      "toDate" in (value as Record<string, unknown>) &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      try {
        return ((value as { toDate: () => Date }).toDate()).toISOString();
      } catch {
        return null;
      }
    }

    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, raw]) => typeof raw !== "undefined" && typeof raw !== "function")
      .sort(([a], [b]) => a.localeCompare(b));

    const normalized: Record<string, unknown> = {};
    sortedEntries.forEach(([key, raw]) => {
      normalized[key] = toSerializable(raw);
    });
    return normalized;
  }
  return value;
}

function stableHash(payload: unknown): string {
  const serialized = JSON.stringify(toSerializable(payload));
  return createHash("sha256").update(serialized).digest("hex");
}

function buildVersionHash(
  proposalId: string,
  proposalData: ProposalDocData,
  tenantData: TenantDocData,
): string {
  const {
    pdf: _pdfMetadata,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...proposalRelevant
  } = proposalData;

  return stableHash({
    templateVersion: PDF_TEMPLATE_VERSION,
    proposalId,
    proposal: proposalRelevant,
    tenant: {
      name: tenantData.name || "",
      primaryColor: tenantData.primaryColor || "",
      logoUrl: tenantData.logoUrl || "",
      proposalDefaults: tenantData.proposalDefaults || null,
    },
  });
}

function getAppBaseUrl(): string {
  const normalizeCandidate = (value: string): string => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  };

  const isSsoPreviewUrl = (value: string): boolean => {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return hostname.endsWith(".vercel.app") && hostname.includes("-git-");
    } catch {
      return false;
    }
  };

  const allowPreview = String(process.env.PDF_ALLOW_PREVIEW_URL || "")
    .trim()
    .toLowerCase() === "true";

  const candidates = [
    process.env.PDF_APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
  ]
    .map((value) => normalizeCandidate(String(value || "")))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (!allowPreview && isSsoPreviewUrl(candidate)) {
      continue;
    }

    return candidate.endsWith("/") ? candidate : `${candidate}/`;
  }

  if (process.env.FUNCTIONS_EMULATOR === "true") {
    return "http://localhost:3000/";
  }

  return "https://proops.com.br/";
}

function buildSharedProposalPayload(
  proposalId: string,
  proposalData: ProposalDocData,
  tenantId: string,
  tenantData: TenantDocData,
): SharedProposalPayload {
  const serializedProposal = {
    id: proposalId,
    ...(toSerializable(proposalData) as Record<string, unknown>),
  };

  return {
    success: true,
    proposal: serializedProposal,
    tenant: {
      id: tenantId,
      name: String(tenantData.name || ""),
      logoUrl: String(tenantData.logoUrl || ""),
      primaryColor: String(tenantData.primaryColor || ""),
    },
  };
}

async function generatePdfFromSharedPage(
  shareUrl: string,
  sharedProposalPayload: SharedProposalPayload,
): Promise<Buffer> {
  chromiumPackage.setGraphicsMode = false;
  const executablePath = await chromiumPackage.executablePath();
  const pageErrors: string[] = [];

  const browser = await chromium.launch({
    executablePath,
    args: chromiumPackage.args,
    headless: true,
  });

  try {
    const page = await browser.newPage({
      viewport: { width: PDF_VIEWPORT_WIDTH, height: PDF_VIEWPORT_HEIGHT },
      deviceScaleFactor: 2,
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error?.message || "unknown_page_error");
    });

    page.on("requestfailed", (request) => {
      const failureText = request.failure()?.errorText || "request_failed";
      pageErrors.push(`${request.method()} ${request.url()} :: ${failureText}`);
    });

    await page.route("**/v1/share/**", async (route, request) => {
      if (request.method() !== "GET") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(sharedProposalPayload),
      });
    });

    await page.goto(shareUrl, {
      waitUntil: "domcontentloaded",
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
    });

    await page.waitForSelector("#shared-proposal-preview-content", {
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
    });

    await page.waitForSelector('[data-pdf-products-ready="1"]', {
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
      state: "attached",
    });

    await page.waitForSelector("#shared-proposal-preview-content [data-page-index]", {
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
    });

    await page.evaluate(() => {
      const previewNode = document.getElementById("shared-proposal-preview-content");
      if (!previewNode) {
        throw new Error("PDF_PREVIEW_NOT_FOUND");
      }

      const clonedNode = previewNode.cloneNode(true) as HTMLElement;
      clonedNode.id = "pdf-root-export";
      clonedNode.style.transform = "none";
      clonedNode.style.margin = "0";
      clonedNode.style.boxShadow = "none";
      clonedNode.style.border = "none";
      clonedNode.style.width = "794px";
      clonedNode.style.minHeight = "1123px";
      clonedNode.style.background = "#ffffff";

      document.body.innerHTML = "";
      document.body.style.margin = "0";
      document.body.style.padding = "0";
      document.body.style.background = "#ffffff";
      document.body.style.width = "794px";
      document.body.style.maxWidth = "794px";
      document.body.appendChild(clonedNode);

      const style = document.createElement("style");
      style.innerHTML = `
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #ffffff; }
        .pdf-page-container {
          margin: 0 !important;
          box-shadow: none !important;
          break-after: page;
          page-break-after: always;
        }
        .pdf-page-container:last-of-type {
          break-after: auto;
          page-break-after: auto;
        }
      `;
      document.head.appendChild(style);
    });

    await page.waitForFunction(
      async () => {
        try {
          await document.fonts.ready;
        } catch {
          // Ignore font readiness errors.
        }

        const imageWaiters = Array.from(document.images).map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
        );

        await Promise.all(imageWaiters);
        return true;
      },
      { timeout: 20_000 },
    );

    await page.emulateMedia({ media: "screen" });
    await page.waitForTimeout(180);

    const pdf = await page.pdf({
      printBackground: true,
      format: "A4",
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdf);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let diagnostics = "UNAVAILABLE";

    try {
      const page = browser.contexts()[0]?.pages()[0];
      if (!page) {
        throw new Error("NO_PAGE_CONTEXT");
      }
      diagnostics = await page.evaluate(() => {
        const bodyText = (document.body?.innerText || "").slice(0, 1200);
        const hasPreviewRoot = Boolean(
          document.querySelector("#shared-proposal-preview-content"),
        );
        const pagesCount = document.querySelectorAll("[data-page-index]").length;
        const isProductsReady =
          document.querySelector('[data-pdf-products-ready="1"]') !== null;

        return JSON.stringify({
          location: window.location.href,
          title: document.title,
          hasPreviewRoot,
          pagesCount,
          isProductsReady,
          bodyText,
        });
      });
    } catch {
      // Ignore diagnostics collection failures.
    }

    throw new Error(`PDF_RENDER_FAILED: ${message} | diagnostics=${diagnostics} | pageErrors=${pageErrors.slice(0, 5).join(" || ")}`);
  } finally {
    await browser.close();
  }
}

export async function getOrGenerateProposalPdfBuffer(
  tenantId: string,
  proposalId: string,
  userId: string,
): Promise<Buffer> {
  const proposalRef = db.collection("proposals").doc(proposalId);
  const proposalSnap = await proposalRef.get();
  if (!proposalSnap.exists) {
    throw new Error("PROPOSAL_NOT_FOUND");
  }

  const proposalData = (proposalSnap.data() || {}) as ProposalDocData;
  const proposalTenantId = String(proposalData.tenantId || "").trim();
  if (!proposalTenantId || proposalTenantId !== tenantId) {
    throw new Error("FORBIDDEN_TENANT_MISMATCH");
  }

  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  const tenantData = (tenantSnap.data() || {}) as TenantDocData;

  const storagePath = getProposalPdfStoragePath(tenantId, proposalId);
  const versionHash = buildVersionHash(proposalId, proposalData, tenantData);
  const currentPdfMetadata = proposalData.pdf || {};

  const isCacheMetadataValid =
    typeof currentPdfMetadata.storagePath === "string" &&
    typeof currentPdfMetadata.versionHash === "string" &&
    currentPdfMetadata.storagePath === storagePath &&
    currentPdfMetadata.versionHash === versionHash;

  const bucket = getStorage().bucket();
  const storageFile = bucket.file(storagePath);

  if (isCacheMetadataValid) {
    const [exists] = await storageFile.exists();
    if (exists) {
      const [cachedBuffer] = await storageFile.download();
      return cachedBuffer;
    }
  }

  const shareLink = await SharedProposalService.createShareLink(
    proposalId,
    tenantId,
    userId,
  );
  const shareUrl = new URL(`/share/${shareLink.token}`, getAppBaseUrl()).toString();
  const sharedProposalPayload = buildSharedProposalPayload(
    proposalId,
    proposalData,
    tenantId,
    tenantData,
  );
  const generatedBuffer = await generatePdfFromSharedPage(
    shareUrl,
    sharedProposalPayload,
  );

  await storageFile.save(generatedBuffer, {
    contentType: "application/pdf",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=3600",
      metadata: {
        tenantId,
        proposalId,
        versionHash,
      },
    },
  });

  await proposalRef.set(
    {
      pdf: {
        storagePath,
        versionHash,
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );

  return generatedBuffer;
}
