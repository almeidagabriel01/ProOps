import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { processFiscalDocumentById } from "./fiscal.service";

export const processFiscalDocuments = onDocumentWritten(
  {
    document: "fiscal_documents/{documentId}",
    region: "southamerica-east1",
    maxInstances: 10,
    retry: false,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;

    const data = after.data() as { status?: string; lockedUntil?: string } | undefined;
    const status = String(data?.status || "").trim().toLowerCase();
    if (status !== "pending" && status !== "cancel_requested") {
      return;
    }

    const lockedUntilMs = Date.parse(String(data?.lockedUntil || ""));
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
      return;
    }

    await processFiscalDocumentById(after.id);
  },
);
