import { createHash } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { db } from "../../init";
import { SharedProposalService } from "./shared-proposal.service";
import { renderPageToPdfBuffer, resolveAppBaseUrl } from "./core-pdf.service";

const PDF_TEMPLATE_VERSION = "proposal-pdf-v7-playwright";
const PDF_GENERATION_LOCK_TIMEOUT_MS = 2 * 60 * 1000;
const PDF_LOCK_WAIT_ATTEMPTS = 6;
const PDF_LOCK_WAIT_INTERVAL_MS = 1_500;

type ProposalPdfMetadata = {
  storagePath?: string;
  versionHash?: string;
};

type PdfGenerationLock = {
  lockedAt?: unknown;
  lockedBy?: unknown;
};

type ProposalDocData = {
  tenantId?: unknown;
  title?: unknown;
  pdf?: ProposalPdfMetadata;
  pdfGenerationLock?: PdfGenerationLock;
  createdAt?: unknown;
  updatedAt?: unknown;
  products?: unknown[];
  [key: string]: unknown;
};

type TenantDocData = {
  name?: unknown;
  primaryColor?: unknown;
  logoUrl?: unknown;
  niche?: unknown;
  proposalDefaults?: unknown;
  [key: string]: unknown;
};

export function buildProposalPdfStoragePath(
  tenantId: string,
  proposalId: string,
): string {
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
        return (value as { toDate: () => Date }).toDate().toISOString();
      } catch {
        return null;
      }
    }

    const sortedEntries = Object.entries(value as Record<string, unknown>)
      .filter(
        ([, raw]) => typeof raw !== "undefined" && typeof raw !== "function",
      )
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
    pdfGenerationLock: _pdfGenerationLock,
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
      niche: tenantData.niche || "",
      proposalDefaults: tenantData.proposalDefaults || null,
    },
  });
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function toDateValue(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in (value as Record<string, unknown>) &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }
  return null;
}

function isCacheMetadataValid(options: {
  metadata: ProposalPdfMetadata | undefined;
  expectedPath: string;
  expectedHash: string;
}): boolean {
  return (
    typeof options.metadata?.storagePath === "string" &&
    typeof options.metadata?.versionHash === "string" &&
    options.metadata.storagePath === options.expectedPath &&
    options.metadata.versionHash === options.expectedHash
  );
}

async function getCachedPdfIfValid(options: {
  metadata: ProposalPdfMetadata | undefined;
  expectedPath: string;
  expectedHash: string;
}): Promise<Buffer | null> {
  if (!isCacheMetadataValid(options)) {
    return null;
  }

  const storageFile = getStorage().bucket().file(options.expectedPath);
  const [exists] = await storageFile.exists();
  if (!exists) return null;

  const [cachedBuffer] = await storageFile.download();
  return cachedBuffer;
}

async function acquirePdfGenerationLock(
  proposalRef: FirebaseFirestore.DocumentReference,
  lockOwner: string,
): Promise<boolean> {
  return db.runTransaction(async (transaction) => {
    const proposalSnap = await transaction.get(proposalRef);
    if (!proposalSnap.exists) {
      throw new Error("PROPOSAL_NOT_FOUND");
    }

    const data = (proposalSnap.data() || {}) as ProposalDocData;
    const currentLock = data.pdfGenerationLock;
    const lockDate = toDateValue(currentLock?.lockedAt);
    const lockIsStale =
      !lockDate ||
      Date.now() - lockDate.getTime() > PDF_GENERATION_LOCK_TIMEOUT_MS;
    const lockOwnerValue = String(currentLock?.lockedBy || "").trim();
    const isLockedByOther =
      Boolean(lockOwnerValue) && !lockIsStale && lockOwnerValue !== lockOwner;

    if (isLockedByOther) {
      return false;
    }

    transaction.update(proposalRef, {
      pdfGenerationLock: {
        lockedAt: FieldValue.serverTimestamp(),
        lockedBy: lockOwner,
      },
    });

    return true;
  });
}

async function waitForPdfGeneratedByAnotherWorker(options: {
  proposalRef: FirebaseFirestore.DocumentReference;
  storagePath: string;
  versionHash: string;
}): Promise<Buffer | null> {
  for (let attempt = 0; attempt < PDF_LOCK_WAIT_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) =>
      setTimeout(resolve, PDF_LOCK_WAIT_INTERVAL_MS),
    );

    const refreshed = await options.proposalRef.get();
    if (!refreshed.exists) {
      throw new Error("PROPOSAL_NOT_FOUND");
    }

    const refreshedData = (refreshed.data() || {}) as ProposalDocData;
    const cachedBuffer = await getCachedPdfIfValid({
      metadata: refreshedData.pdf,
      expectedPath: options.storagePath,
      expectedHash: options.versionHash,
    });
    if (cachedBuffer) {
      return cachedBuffer;
    }
  }

  return null;
}

async function generatePdfFromUrl(url: string): Promise<Buffer> {
  const appBaseUrl = resolveAppBaseUrl();
  return renderPageToPdfBuffer({
    url: `${url}?print=1`,
    readySelector: '[data-pdf-products-ready="1"]',
    appOrigin: appBaseUrl,
    vercelBypassSecret: process.env.VERCEL_PROTECTION_BYPASS_SECRET || "",
  });
}

export async function getOrGenerateProposalPdf(
  tenantId: string,
  proposalId: string,
  isSuperAdmin = false,
): Promise<{ buffer: Buffer; proposalTitle: string }> {
  const proposalRef = db.collection("proposals").doc(proposalId);
  const proposalSnap = await proposalRef.get();
  if (!proposalSnap.exists) {
    throw new Error("PROPOSAL_NOT_FOUND");
  }

  const proposalData = (proposalSnap.data() || {}) as ProposalDocData;
  const proposalTenantId = toStringValue(proposalData.tenantId);
  if (!isSuperAdmin) {
    if (!proposalTenantId || proposalTenantId !== tenantId) {
      throw new Error("FORBIDDEN_TENANT_MISMATCH");
    }
  }

  const effectiveTenantId =
    isSuperAdmin && proposalTenantId ? proposalTenantId : tenantId;

  const tenantSnap = await db
    .collection("tenants")
    .doc(effectiveTenantId)
    .get();
  const tenantData = (tenantSnap.data() || {}) as TenantDocData;

  const storagePath = buildProposalPdfStoragePath(
    effectiveTenantId,
    proposalId,
  );
  const versionHash = buildVersionHash(proposalId, proposalData, tenantData);
  const proposalTitle = toStringValue(proposalData.title);

  const cachedBuffer = await getCachedPdfIfValid({
    metadata: proposalData.pdf,
    expectedPath: storagePath,
    expectedHash: versionHash,
  });
  if (cachedBuffer) {
    return { buffer: cachedBuffer, proposalTitle };
  }

  const lockOwner = `pdf-${proposalId}-${Date.now()}`;
  const lockAcquired = await acquirePdfGenerationLock(proposalRef, lockOwner);

  if (!lockAcquired) {
    const waitedBuffer = await waitForPdfGeneratedByAnotherWorker({
      proposalRef,
      storagePath,
      versionHash,
    });
    if (waitedBuffer) {
      return { buffer: waitedBuffer, proposalTitle };
    }
    throw new Error("PDF_GENERATION_IN_PROGRESS");
  }

  try {
    const postLockSnap = await proposalRef.get();
    if (!postLockSnap.exists) {
      throw new Error("PROPOSAL_NOT_FOUND");
    }

    const postLockData = (postLockSnap.data() || {}) as ProposalDocData;
    const postLockVersionHash = buildVersionHash(
      proposalId,
      postLockData,
      tenantData,
    );
    const postLockCachedBuffer = await getCachedPdfIfValid({
      metadata: postLockData.pdf,
      expectedPath: storagePath,
      expectedHash: postLockVersionHash,
    });
    if (postLockCachedBuffer) {
      return {
        buffer: postLockCachedBuffer,
        proposalTitle: toStringValue(postLockData.title),
      };
    }

    const shareData = await SharedProposalService.createInternalRenderLink(
      proposalId,
      effectiveTenantId,
      "system-pdf-generator",
    );

    const generatedBuffer = await generatePdfFromUrl(shareData.shareUrl);
    const storageFile = getStorage().bucket().file(storagePath);

    await storageFile.save(generatedBuffer, {
      contentType: "application/pdf",
      resumable: false,
      metadata: {
        cacheControl: "private, max-age=3600",
        metadata: {
          tenantId: effectiveTenantId,
          proposalId,
          versionHash: postLockVersionHash,
        },
      },
    });

    await proposalRef.set(
      {
        pdf: {
          storagePath,
          versionHash: postLockVersionHash,
          updatedAt: FieldValue.serverTimestamp(),
        },
        pdfGenerationLock: FieldValue.delete(),
      },
      { merge: true },
    );

    return {
      buffer: generatedBuffer,
      proposalTitle: toStringValue(postLockData.title),
    };
  } catch (error) {
    await proposalRef.set(
      {
        pdfGenerationLock: FieldValue.delete(),
      },
      { merge: true },
    );
    throw error;
  }
}

export async function getOrGenerateProposalPdfBuffer(
  tenantId: string,
  proposalId: string,
  isSuperAdmin = false,
): Promise<Buffer> {
  const result = await getOrGenerateProposalPdf(
    tenantId,
    proposalId,
    isSuperAdmin,
  );
  return result.buffer;
}
