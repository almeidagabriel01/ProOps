/**
 * Utilitários de nome de arquivo para PDFs.
 *
 * Implementação local no frontend — não importamos de functions/ para evitar
 * crossing do boundary do monorepo (o Next.js não deve depender de código
 * do diretório functions/).
 *
 * A lógica deve ser mantida em sincronia com
 * functions/src/shared/pdf/pdf-filename.ts (mesma fonte canônica de regras).
 */

export interface BuildPdfFilenameOptions {
  prefix?: string;
  fallbackName?: string;
}

export function sanitizePdfFilename(value: string): string {
  return value
    .replace(/[\\u0000-\\u001f\\u007f]/g, "")
    .replace(/[<>:"/\\|?*;]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toAsciiFilename(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "");
  return sanitizePdfFilename(normalized);
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
  const filename = buildPdfFilename(title, {
    prefix: "Proposta",
    fallbackName: "Proposta.pdf",
  });

  return /^roposta\b/i.test(filename) && !/^proposta\b/i.test(filename)
    ? `P${filename}`
    : filename;
}

export function buildReceiptPdfFilename(title?: string): string {
  return buildPdfFilename(title, {
    prefix: "Recibo",
    fallbackName: "Recibo.pdf",
  });
}

export function buildPdfContentDisposition(filename: string): string {
  const safeFilename = sanitizePdfFilename(filename || "download.pdf") || "download.pdf";
  const asciiFallback = toAsciiFilename(safeFilename) || "download.pdf";
  const encodedFilename = encodeURIComponent(safeFilename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`;
}
