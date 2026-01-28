/**
 * Constants for PDF page layout and height estimation
 */

// A4 dimensions: 210mm x 297mm at 96 DPI
// 297mm = 1123px, 210mm = 794px
export const PAGE_HEIGHT_PX = 1123;
export const CONTENT_MARGIN_Y = 180; // Top padding (48px) + Bottom padding (48px) + Footer space (84px)
export const SAFE_HEIGHT = PAGE_HEIGHT_PX - CONTENT_MARGIN_Y;

// Estimated heights for different content types
export const ESTIMATED_HEIGHTS = {
  HEADER: 100,
  SECTION_PADDING: 20,
  LINE_HEIGHT: 24,
  IMAGE_DEFAULT: 200,
  PRODUCT_HEADER: 50,
  PRODUCT_ROW: 150,
  TOTALS: 120,
  PAYMENT_TERMS: 100,
};

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

    if (section.styles?.marginTop) {
      height += parseInt(section.styles.marginTop as string) || 0;
    }
    if (section.styles?.marginBottom) {
      height += parseInt(section.styles.marginBottom as string) || 0;
    }
  } else if (section.type === "image") {
    height += ESTIMATED_HEIGHTS.IMAGE_DEFAULT;
  } else if (section.type === "divider") {
    height += 20;
  }

  return height;
}

/**
 * Calculate product row height based on images and description
 */
export function calculateProductHeight(
  product: Product,
  baseHeight: number = 80,
  settings?: PdfDisplaySettings,
): number {
  let height = baseHeight;

  // Check settings (default to true if undefined)
  const showImages = settings?.showProductImages !== false;
  const showDescriptions = settings?.showProductDescriptions !== false;

  if (
    showImages &&
    ((product.productImages && product.productImages.length > 0) ||
      product.productImage)
  ) {
    height += 100; // Image row height
  }

  if (
    showDescriptions &&
    product.productDescription &&
    product.productDescription.length > 100
  ) {
    height += 20;
  }

  return height;
}

/**
 * Calculate sistema block height
 */
export function calculateSistemaBlockHeight(
  products: Product[],
  settings?: PdfDisplaySettings,
): number {
  let totalHeight = 100; // Header height

  const showImages = settings?.showProductImages !== false;
  const showDescriptions = settings?.showProductDescriptions !== false;

  products.forEach((product) => {
    let h = 80; // Base product height
    const imageCount =
      product.productImages?.length || (product.productImage ? 1 : 0);

    if (showImages && imageCount > 0) {
      h += 100; // Adjusted to match actual render (80px img + 12px margin + padding)
    }

    if (
      showDescriptions &&
      product.productDescription &&
      product.productDescription.length > 100
    ) {
      h += 20;
    }

    totalHeight += h;
  });

  totalHeight += 60; // Footer height
  return totalHeight;
}

export function calculatePaymentTermsHeight(
  hasDownPayment: boolean,
  installmentsCount: number = 0,
): number {
  let height = 60; // Title + Header

  // Table header
  height += 40;

  if (hasDownPayment) {
    height += 30; // Row height
  }

  if (installmentsCount > 0) {
    height += installmentsCount * 30; // Row height for each installment
  }

  height += 60; // Total row + margin
  height += 80; // Summary text section
  return height;
}
