export const PDF_FONT_STACKS = {
  inter: "var(--font-pdf-inter), 'Inter', sans-serif",
  playfair: "var(--font-pdf-playfair), 'Playfair Display', serif",
  georgia: "Georgia, serif",
  roboto: "var(--font-pdf-roboto), 'Roboto', sans-serif",
  lato: "var(--font-pdf-lato), 'Lato', sans-serif",
  montserrat: "var(--font-pdf-montserrat), 'Montserrat', sans-serif",
  arial: "Arial, sans-serif",
} as const;

export const DEFAULT_PDF_FONT_FAMILY = PDF_FONT_STACKS.inter;

const LEGACY_FONT_MAP: Record<string, string> = {
  "'Inter', sans-serif": PDF_FONT_STACKS.inter,
  "Inter, sans-serif": PDF_FONT_STACKS.inter,
  "'Playfair Display', serif": PDF_FONT_STACKS.playfair,
  "Playfair Display, serif": PDF_FONT_STACKS.playfair,
  "var(--font-pdf-playfair), 'Playfair Display', serif": PDF_FONT_STACKS.playfair,
  "Georgia, serif": PDF_FONT_STACKS.georgia,
  "'Roboto', sans-serif": PDF_FONT_STACKS.roboto,
  "Roboto, sans-serif": PDF_FONT_STACKS.roboto,
  "'Lato', sans-serif": PDF_FONT_STACKS.lato,
  "Lato, sans-serif": PDF_FONT_STACKS.lato,
  "'Montserrat', sans-serif": PDF_FONT_STACKS.montserrat,
  "Montserrat, sans-serif": PDF_FONT_STACKS.montserrat,
  "Arial, sans-serif": PDF_FONT_STACKS.arial,
};

export const pdfFontOptions = [
  { value: PDF_FONT_STACKS.inter, label: "Inter (Moderna)" },
  { value: PDF_FONT_STACKS.playfair, label: "Playfair Display (Elegante)" },
  { value: PDF_FONT_STACKS.georgia, label: "Georgia (Clássica)" },
  { value: PDF_FONT_STACKS.roboto, label: "Roboto (Clean)" },
  { value: PDF_FONT_STACKS.lato, label: "Lato (Profissional)" },
  { value: PDF_FONT_STACKS.montserrat, label: "Montserrat (Moderna)" },
  { value: PDF_FONT_STACKS.arial, label: "Arial (Simples)" },
] as const;

type PdfFontOptionWithId = {
  id: string;
  value: string;
  label: string;
};

const buildFontOptionId = (label: string, value: string): string =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || value;

export const pdfFontOptionsWithId: readonly PdfFontOptionWithId[] = pdfFontOptions
  .map((option) => ({
    id: buildFontOptionId(option.label, option.value),
    value: option.value,
    label: option.label,
  }))
  .filter(
    (option, index, all) =>
      all.findIndex((entry) => entry.id === option.id || entry.value === option.value) === index,
  );

function normalizeQuotedFamilyName(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "");
}

export function normalizePdfFontFamily(value?: string | null): string {
  if (!value) return DEFAULT_PDF_FONT_FAMILY;
  const trimmed = value.trim();
  if (LEGACY_FONT_MAP[trimmed]) return LEGACY_FONT_MAP[trimmed];

  const normalized = trimmed
    .split(",")
    .map((part) => normalizeQuotedFamilyName(part))
    .join(", ");

  return LEGACY_FONT_MAP[normalized] || trimmed;
}

export function extractConcreteFontFamilies(fontFamily: string): string[] {
  const genericFamilies = new Set([
    "serif",
    "sans-serif",
    "monospace",
    "cursive",
    "fantasy",
    "system-ui",
    "ui-sans-serif",
    "ui-serif",
    "ui-monospace",
  ]);

  return fontFamily
    .split(",")
    .map((part) => normalizeQuotedFamilyName(part))
    .map((part) => part.replace(/^var\(.+\)\s*$/i, ""))
    .map((part) => part.trim())
    .filter((part) => part && !genericFamilies.has(part.toLowerCase()));
}
