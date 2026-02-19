import { DebugLogger } from "./render-to-pdf.types";

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

function slugify(value?: string): string {
  return (value || "comercial")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildProposalPdfFilename(title?: string): string {
  return `proposta-${slugify(title)}.pdf`;
}
