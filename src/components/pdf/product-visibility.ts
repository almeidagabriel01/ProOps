type PdfLikeProduct = {
  quantity?: number;
  status?: "active" | "inactive";
  _isGhost?: boolean;
  _isInactive?: boolean;
  _shouldHide?: boolean;
};

/**
 * Single source of truth for proposal PDF item visibility and totals.
 */
export function isProductVisibleInPdf(product: PdfLikeProduct): boolean {
  const quantity = Number(product.quantity || 0);
  if (quantity <= 0) return false;
  if (product._isGhost) return false;
  if (product.status === "inactive") return false;
  if (product._isInactive) return false;
  if (product._shouldHide) return false;
  return true;
}

/**
 * Items that should participate in PDF totals/subtotals.
 * Inactive items still count, but zero/negative quantities never count.
 */
export function shouldCountInPdfTotals(product: PdfLikeProduct): boolean {
  const quantity = Number(product.quantity || 0);
  if (quantity <= 0) return false;
  if (product._isGhost) return false;
  return true;
}
