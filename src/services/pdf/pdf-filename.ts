export interface BuildPdfFilenameOptions {
  prefix?: string;
  fallbackName?: string;
}

export function sanitizePdfFilename(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*;]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildPdfFilename(
  title?: string,
  options: BuildPdfFilenameOptions = {},
): string {
  const prefix = sanitizePdfFilename(options.prefix || "Proposta") || "Proposta";
  const fallbackName =
    sanitizePdfFilename(options.fallbackName || `${prefix}.pdf`) ||
    `${prefix}.pdf`;
  const clean = sanitizePdfFilename(title || "");
  return clean ? `${prefix} - ${clean}.pdf` : fallbackName;
}

export function buildProposalPdfFilename(title?: string): string {
  return buildPdfFilename(title, {
    prefix: "Proposta",
    fallbackName: "Proposta.pdf",
  });
}

export function buildReceiptPdfFilename(title?: string): string {
  return buildPdfFilename(title, {
    prefix: "Recibo",
    fallbackName: "Recibo.pdf",
  });
}
