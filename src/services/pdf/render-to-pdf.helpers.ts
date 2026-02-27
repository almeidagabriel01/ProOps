import { DebugLogger } from "./render-to-pdf.types";
import { buildProposalPdfFilename as buildSharedProposalPdfFilename } from "./pdf-filename";

export function getApiBaseUrl(rawApiBaseUrl?: string): string {
  const apiUrl = rawApiBaseUrl || process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not defined.");
  }
  return apiUrl;
}

export function getPdfDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.search.includes("pdfDebug=1");
}

export function createDebugLogger(): DebugLogger {
  const enabled = getPdfDebugEnabled() && process.env.NODE_ENV === "development";
  return (message, payload) => {
    if (!enabled) return;
    if (payload === undefined) {
      console.debug(`[pdf-debug] ${message}`);
    } else {
      console.debug(`[pdf-debug] ${message}`, payload);
    }
  };
}

export function buildProposalPdfFilename(title?: string): string {
  return buildSharedProposalPdfFilename(title);
}
