import { FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { db } from "../../../init";
import {
  downloadPdfFromSafeUrl,
  isUrlAccessible,
  parseStoragePathFromUrl,
} from "./whatsapp.utils";
import { getProposalByIdForTenant } from "./whatsapp.db";
import {
  buildProposalPdfStoragePath,
  getOrGenerateProposalPdfBuffer,
} from "../proposal-pdf.service";

type PdfMetadataLike = {
  storagePath?: unknown;
  versionHash?: unknown;
};

function extractAttachmentPdfUrl(proposal: Record<string, unknown>): string {
  const attachments = Array.isArray(proposal.attachments) ? proposal.attachments : [];
  return (
    attachments
      .map((attachment) => {
        const typedAttachment = attachment as {
          name?: unknown;
          type?: unknown;
          url?: unknown;
        };
        const name = String(typedAttachment.name || "").toLowerCase();
        const type = String(typedAttachment.type || "").toLowerCase();
        if (type === "pdf" || name.endsWith(".pdf")) {
          return String(typedAttachment.url || "").trim();
        }
        return "";
      })
      .find((url) => Boolean(url)) || ""
  );
}

function buildPathCandidates(options: {
  proposal: Record<string, unknown>;
  standardPath: string;
  attachmentPdfUrl: string;
  existingPdfUrl: string;
  existingPdfPath: string;
}): string[] {
  const metadataPath = String(
    ((options.proposal.pdf || {}) as PdfMetadataLike).storagePath || "",
  ).trim();

  return Array.from(
    new Set(
      [
        metadataPath,
        options.existingPdfPath,
        parseStoragePathFromUrl(options.existingPdfUrl),
        parseStoragePathFromUrl(options.attachmentPdfUrl),
        options.standardPath,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
}

async function saveCanonicalPdfMetadata(options: {
  proposalRef: FirebaseFirestore.DocumentReference;
  storagePath: string;
}): Promise<void> {
  await options.proposalRef.set(
    {
      pdf: {
        storagePath: options.storagePath,
        updatedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );
}

export async function getOrGenerateProposalPdf(
  tenantId: string,
  proposalId: string,
): Promise<{ pdfBuffer: Buffer; pdfPath: string }> {
  const proposal = (await getProposalByIdForTenant(tenantId, proposalId)) as
    | (Record<string, unknown> & { id: string })
    | null;

  if (!proposal) {
    throw new Error("PROPOSAL_NOT_FOUND");
  }

  const bucket = getStorage().bucket();
  const standardPath = buildProposalPdfStoragePath(tenantId, proposal.id);
  const proposalRef = db.collection("proposals").doc(proposal.id);

  const attachmentPdfUrl = extractAttachmentPdfUrl(proposal);
  const existingPdfUrl = String(proposal.pdfUrl || "").trim();
  const existingPdfPath = String(proposal.pdfPath || "").trim();
  const preferredExistingUrl = existingPdfUrl || attachmentPdfUrl || "";

  if (preferredExistingUrl && (await isUrlAccessible(preferredExistingUrl))) {
    const resolvedPath =
      String(((proposal.pdf || {}) as PdfMetadataLike).storagePath || "").trim() ||
      existingPdfPath ||
      parseStoragePathFromUrl(preferredExistingUrl) ||
      standardPath;

    await saveCanonicalPdfMetadata({
      proposalRef,
      storagePath: resolvedPath,
    });

    try {
      const file = bucket.file(resolvedPath);
      const [exists] = await file.exists();
      if (exists) {
        const [buffer] = await file.download();
        return { pdfBuffer: buffer, pdfPath: resolvedPath };
      }

      const remotePdfBuffer = await downloadPdfFromSafeUrl(preferredExistingUrl);
      if (remotePdfBuffer) {
        return { pdfBuffer: remotePdfBuffer, pdfPath: resolvedPath };
      }
    } catch (error) {
      console.error("Failed to download existing pdf", error);
    }
  }

  const pathCandidates = buildPathCandidates({
    proposal,
    standardPath,
    attachmentPdfUrl,
    existingPdfUrl,
    existingPdfPath,
  });

  for (const pathCandidate of pathCandidates) {
    const file = bucket.file(pathCandidate);
    const [exists] = await file.exists();
    if (!exists) continue;

    const [buffer] = await file.download();

    await saveCanonicalPdfMetadata({
      proposalRef,
      storagePath: pathCandidate,
    });

    console.log("[WhatsApp] PDF found existing in bucket", {
      proposalId: proposal.id,
      tenantId,
      pdfPath: pathCandidate,
    });
    return { pdfBuffer: buffer, pdfPath: pathCandidate };
  }

  let generatedPdfBuffer: Buffer | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      generatedPdfBuffer = await getOrGenerateProposalPdfBuffer(
        tenantId,
        proposalId,
      );
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      if (message !== "PDF_GENERATION_IN_PROGRESS" || attempt === 4) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  if (!generatedPdfBuffer) {
    throw new Error("PDF_GENERATION_IN_PROGRESS");
  }

  console.log("[WhatsApp] PDF generated", {
    proposalId: proposal.id,
    tenantId,
    pdfPath: standardPath,
  });

  return { pdfBuffer: generatedPdfBuffer, pdfPath: standardPath };
}
