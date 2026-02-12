/**
 * Constants for PDF page layout and height estimation
 */

// A4 dimensions: 210mm x 297mm at 96 DPI
// 297mm = 1123px, 210mm = 794px
export const PAGE_HEIGHT_PX = 1123;
export const CONTENT_MARGIN_Y = 100; // Reduced from 150 to maximize page space
export const SAFE_HEIGHT = PAGE_HEIGHT_PX - CONTENT_MARGIN_Y;

// Debug mode flag - set to true to enable console logging
export const PDF_DEBUG = false;

// Estimated heights for different content types
export const ESTIMATED_HEIGHTS = {
  HEADER: 100,
  SECTION_PADDING: 20,
  LINE_HEIGHT: 24,
  IMAGE_DEFAULT: 200,
  PRODUCT_HEADER: 50,
  PRODUCT_ROW: 150,
  TOTALS: 80, // Reduced from 120
  PAYMENT_TERMS: 100,
};

/**
 * Debug logging helper
 */
export function pdfDebugLog(message: string, data?: unknown): void {
  if (PDF_DEBUG) {
    if (data !== undefined) {
      console.log(`[PDF-DEBUG] ${message}`, data);
    } else {
      console.log(`[PDF-DEBUG] ${message}`);
    }
  }
}

/**
 * Content item types for rendering
 */
export type ContentItemType =
  | "section"
  | "sistema-block"
  | "extra-products-block"
  | "product-header"
  | "product-row"
  | "totals"
  | "sistema-header"
  | "sistema-product"
  | "sistema-footer"
  | "extra-products-header"
  | "ambiente-header"
  | "sistema-container-header"
  | "sistema-container-product"
  | "sistema-container-footer"
  | "sistema-extras-block"
  | "payment-terms";

export interface ContentItem {
  type: ContentItemType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  height: number;
  id?: string; // Unique identifier for DOM measurement
}

// Type definitions for helper functions
interface PdfSection {
  type: string;
  content?: string;
  styles?: {
    marginTop?: string | number;
    marginBottom?: string | number;
  };
}

interface Product {
  productImages?: string[];
  productImage?: string;
  productDescription?: string;
}

interface PdfDisplaySettings {
  showProductImages?: boolean;
  showProductDescriptions?: boolean;
}

/**
 * Calculate text section height based on content
 */
export function calculateSectionHeight(section: PdfSection): number {
  let height = ESTIMATED_HEIGHTS.SECTION_PADDING;

  if (section.type === "text") {
    // Improved estimation considering word wrapping
    const charCount = section.content?.length || 0;
    const charsPerLine = 90; // Conservative estimate for A4 width
    const estimatedWrapLines = Math.ceil(charCount / charsPerLine);
    const explicitLines = (section.content || "").split("\n").length;
    const totalLines = Math.max(estimatedWrapLines, explicitLines);

    height += totalLines * ESTIMATED_HEIGHTS.LINE_HEIGHT;
  } else if (section.type === "title") {
    const charCount = section.content?.length || 0;
    const charsPerLine = 50;
    const estimatedWrapLines = Math.ceil(Math.max(1, charCount) / charsPerLine);
    const explicitLines = (section.content || "").split("\n").length;
    const totalLines = Math.max(estimatedWrapLines, explicitLines);

    height += totalLines * (ESTIMATED_HEIGHTS.LINE_HEIGHT + 6);
  } else if (section.type === "image") {
    height += ESTIMATED_HEIGHTS.IMAGE_DEFAULT;
  } else if (section.type === "divider") {
    height += 20;
  }

  if (section.styles?.marginTop) {
    height += parseInt(section.styles.marginTop as string) || 0;
  }
  if (section.styles?.marginBottom) {
    height += parseInt(section.styles.marginBottom as string) || 0;
  }

  return height;
}

/**
 * Calculate product height - balanced for cutoff prevention
 *
 * Uses CSS break-inside-avoid + conservative height estimates
 * to prevent products from being cut across pages.
 *
 * Layout (vertical):
 * - Header row: ~42px (title + price + quantity)
 * - Container padding (p-3): 12px top + 12px bottom = 24px
 * - Spacing buffer: 9px
 * Total base: 75px
 *
 * Images (w-16 h-16 = 64px, gap-1.5 = 6px, pt-1 = 4px):
 * - Per row: ~70px (includes gaps and buffers)
 * - First row adds 4px top padding
 *
 * Description (text-[10px] leading-relaxed, pt-1 = 4px):
 * - Line height: ~15px (includes spacing)
 * - ~50 chars per line
 */
export function calculateProductHeight(
  product: Product,
  baseHeight: number = 70, // Balanced: not too conservative, not too aggressive
  settings?: PdfDisplaySettings,
): number {
  let height = baseHeight;

  const showImages = settings?.showProductImages !== false;
  const showDescriptions = settings?.showProductDescriptions !== false;

  // Image gallery height
  if (showImages) {
    const imageCount =
      product.productImages?.length || (product.productImage ? 1 : 0);

    if (imageCount > 0) {
      const rows = Math.ceil(imageCount / 4);
      height += rows * 60 + 4; // 60px per row
    }
  }

  // Description height
  if (showDescriptions && product.productDescription) {
    const descLength = product.productDescription.length;
    const estimatedLines = Math.ceil(descLength / 50); // ~50 chars per line
    height += estimatedLines * 14 + 2; // 14px per line
  }

  // Small safety buffer to prevent cutoff
  height += 10;

  return height;
}

/**
 * Calculate sistema block height
 */
export function calculateSistemaBlockHeight(
  products: Product[],
  settings?: PdfDisplaySettings,
): number {
  let totalHeight = 80; // Header height (balanced)

  // Use the updated product height calculation for each product
  products.forEach((product) => {
    const productHeight = calculateProductHeight(product, 70, settings); // Use same base as default
    totalHeight += productHeight + 8; // +8 for gap between products
  });

  totalHeight += 50; // Footer height
  return totalHeight;
}

export function calculatePaymentTermsHeight(
  hasDownPayment: boolean,
  installmentsCount: number = 0,
): number {
  let height = 50; // Title

  // Table header
  height += 30;

  if (hasDownPayment) {
    height += 25; // Row height
  }

  if (installmentsCount > 0) {
    height += installmentsCount * 28; // Row height for each installment
  }

  height += 50; // Total row + margin
  height += 60; // Summary text section

  // Safety buffer
  height += 20;

  return height;
}
