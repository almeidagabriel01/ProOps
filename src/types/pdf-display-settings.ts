// PDF Display Settings Type
// Shared across form and PDF components for configuration

export interface PdfDisplaySettings {
  showProductImages: boolean;
  showProductDescriptions: boolean;
  showProductPrices: boolean;
  showProductMeasurements: boolean;
  showSubtotals: boolean;
  showEnvironmentSubtotals: boolean;
  showPaymentTerms: boolean;
  showLogo: boolean;
  showValidUntil: boolean;
  showNotes: boolean;
  [key: string]: unknown;
}

// Default settings
export const defaultPdfDisplaySettings: PdfDisplaySettings = {
  showProductImages: true,
  showProductDescriptions: true,
  showProductPrices: false,
  showProductMeasurements: true,
  showSubtotals: true,
  showEnvironmentSubtotals: false,
  showPaymentTerms: true,
  showLogo: true,
  showValidUntil: true,
  showNotes: true,
};

// Helper to merge saved settings with defaults
export function mergePdfDisplaySettings(
  saved?: Partial<PdfDisplaySettings> | Record<string, unknown>,
): PdfDisplaySettings {
  return {
    ...defaultPdfDisplaySettings,
    ...(saved as Partial<PdfDisplaySettings>),
  };
}
