export function sanitizePdfFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, "").trim();
}

export function buildPdfFilename(title?: string): string {
  const clean = sanitizePdfFilename(title || "");
  return clean ? `Proposta - ${clean}.pdf` : "Proposta.pdf";
}
