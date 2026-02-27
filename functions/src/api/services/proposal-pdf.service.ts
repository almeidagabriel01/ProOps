import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { chromium } from "playwright-core";
import chromiumPackage from "@sparticuz/chromium";
import { db } from "../../init";
import { SharedProposalService } from "./shared-proposal.service";

const PDF_TEMPLATE_VERSION = "proposal-pdf-v3-frontend-puppeteer";
const PDF_VIEWPORT_WIDTH = 1280;
const PDF_VIEWPORT_HEIGHT = 1700;
const PDF_PAGE_READY_TIMEOUT_MS = 45_000;
const PDF_RENDER_ASSET_TIMEOUT_MS = 20_000;

type ProposalPdfMetadata = {
  storagePath?: string;
  versionHash?: string;
};

type ProposalDocData = {
  tenantId?: unknown;
  pdf?: ProposalPdfMetadata;
  createdAt?: unknown;
  updatedAt?: unknown;
  products?: unknown[];
  [key: string]: unknown;
};

type TenantDocData = {
  name?: unknown;
  primaryColor?: unknown;
  logoUrl?: unknown;
  proposalDefaults?: unknown;
  [key: string]: unknown;
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

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}



async function generatePdfFromUrl(url: string): Promise<Buffer> {
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
    });

    const bypassSecret = process.env.VERCEL_PROTECTION_BYPASS_SECRET || "";
    const extraHeaders: Record<string, string> = {
      "x-pdf-generator": "true",
    };
    if (bypassSecret) {
      extraHeaders["x-vercel-protection-bypass"] = bypassSecret;
    }
    await page.setExtraHTTPHeaders(extraHeaders);

    page.on("pageerror", (error) => {
      pageErrors.push(error?.message || "unknown_page_error");
    });

    page.on("requestfailed", (request) => {
      const failureText = request.failure()?.errorText || "request_failed";
      pageErrors.push(`${request.method()} ${request.url()} :: ${failureText}`);
    });

    await page.goto(`${url}?print=1`, {
      waitUntil: "networkidle",
      timeout: PDF_PAGE_READY_TIMEOUT_MS,
    });

    await page.waitForFunction(
      async () => {
        try {
          await document.fonts.ready;
        } catch {
          // Ignore fonts readiness failures.
        }

        const pdfReadyMarker = document.querySelector('[data-pdf-products-ready="1"]');
        if (!pdfReadyMarker) {
           return false;
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
      { timeout: PDF_RENDER_ASSET_TIMEOUT_MS },
    );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.emulateMedia({ media: "print" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
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
    const diagnostics = pageErrors.slice(0, 8).join(" || ") || "UNAVAILABLE";
    throw new Error(`PDF_RENDER_FAILED: ${message} | pageErrors=${diagnostics}`);
  } finally {
    await browser.close();
  }
}

export async function getOrGenerateProposalPdfBuffer(
  tenantId: string,
  proposalId: string,
): Promise<Buffer> {
  const proposalRef = db.collection("proposals").doc(proposalId);
  const proposalSnap = await proposalRef.get();
  if (!proposalSnap.exists) {
    throw new Error("PROPOSAL_NOT_FOUND");
  }

  const proposalData = (proposalSnap.data() || {}) as ProposalDocData;
  const proposalTenantId = toStringValue(proposalData.tenantId);
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

  const shareData = await SharedProposalService.createShareLink(
    proposalId,
    tenantId,
    "system-pdf-generator",
  );

  const generatedBuffer = await generatePdfFromUrl(shareData.shareUrl);

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
