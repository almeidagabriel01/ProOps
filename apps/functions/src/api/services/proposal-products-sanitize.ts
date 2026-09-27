/**
 * Limpeza dos itens de uma proposta que chegam do cliente, antes de gravar.
 *
 * Os modos por medida (`curtain_*`, ids históricos gravados em produtos e
 * propostas) guardam as medidas da linha. O número de painéis entra junto:
 * até 2026-09 ele era descartado aqui, e a tela o deduzia de volta dividindo a
 * quantidade pela medida, o que erra com medida zero ou arredondamento.
 */

export const MAX_PRODUCTS_PER_PROPOSAL = 500;
const MAX_PANELS = 99;

function sanitizeProposalNumber(value: unknown, decimals = 2): number {
  const parsed = Number(
    typeof value === "string" ? value.replace(",", ".") : value,
  );
  if (!Number.isFinite(parsed)) return 0;
  const factor = 10 ** decimals;
  return Math.max(0, Math.round(parsed * factor) / factor);
}

/**
 * Painéis são inteiros de 1 a 99. Ausente ou inválido: o campo fica de fora, e
 * a proposta antiga continua lida pela dedução da tela.
 */
function sanitizePanels(value: unknown): { panels?: number } {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_PANELS) return {};
  return { panels: parsed };
}

export function sanitizeProposalPricingDetails(
  rawValue: unknown,
): Record<string, unknown> {
  const source =
    rawValue && typeof rawValue === "object"
      ? (rawValue as Record<string, unknown>)
      : {};
  const mode = String(source.mode || "").trim().toLowerCase();

  if (mode === "curtain_meter") {
    const width = sanitizeProposalNumber(source.width, 4);
    const height = sanitizeProposalNumber(source.height, 4);
    return {
      mode: "curtain_meter",
      width,
      height,
      area: sanitizeProposalNumber(width * height, 4),
      ...sanitizePanels(source.panels),
    };
  }

  if (mode === "curtain_height") {
    return {
      mode: "curtain_height",
      width: sanitizeProposalNumber(source.width, 4),
      tierId: String(source.tierId || "").trim().slice(0, 120),
      maxHeight: sanitizeProposalNumber(source.maxHeight, 4),
      ...sanitizePanels(source.panels),
    };
  }

  if (mode === "curtain_width") {
    return {
      mode: "curtain_width",
      width: sanitizeProposalNumber(source.width, 4),
      ...sanitizePanels(source.panels),
    };
  }

  return { mode: "standard" };
}

export function sanitizeProposalProductsInput(rawValue: unknown): Record<string, unknown>[] {
  if (typeof rawValue === "undefined" || rawValue === null) {
    return [];
  }
  if (!Array.isArray(rawValue) || rawValue.length > MAX_PRODUCTS_PER_PROPOSAL) {
    throw new Error("INVALID_PRODUCTS");
  }

  return rawValue.map((rawProduct, index) => {
    const source =
      rawProduct && typeof rawProduct === "object"
        ? (rawProduct as Record<string, unknown>)
        : {};
    const itemType =
      String(source.itemType || "product").trim().toLowerCase() === "service"
        ? "service"
        : "product";
    const status =
      String(source.status || "active").trim().toLowerCase() === "inactive"
        ? "inactive"
        : "active";

    return {
      lineItemId: String(source.lineItemId || `proposal-item-${index + 1}`)
        .trim()
        .slice(0, 160),
      productId: String(source.productId || "").trim().slice(0, 160),
      itemType,
      productName: String(source.productName || "").trim().slice(0, 300),
      productImage: String(source.productImage || "").trim().slice(0, 4096),
      productImages: Array.isArray(source.productImages)
        ? source.productImages
            .filter((image): image is string => typeof image === "string")
            .map((image) => image.trim().slice(0, 4096))
            .filter(Boolean)
            .slice(0, 12)
        : [],
      productDescription: String(source.productDescription || "")
        .trim()
        .slice(0, 4000),
      quantity: sanitizeProposalNumber(source.quantity, 4),
      unitPrice: sanitizeProposalNumber(source.unitPrice, 4),
      markup: itemType === "service" ? 0 : sanitizeProposalNumber(source.markup, 4),
      priceManuallyEdited: Boolean(source.priceManuallyEdited),
      total: sanitizeProposalNumber(source.total, 4),
      manufacturer: String(source.manufacturer || "").trim().slice(0, 160),
      category: String(source.category || "").trim().slice(0, 160),
      systemInstanceId: String(source.systemInstanceId || "")
        .trim()
        .slice(0, 200),
      ambienteInstanceId: String(source.ambienteInstanceId || "")
        .trim()
        .slice(0, 200),
      isExtra: Boolean(source.isExtra),
      status,
      pricingDetails:
        itemType === "service"
          ? { mode: "standard" }
          : sanitizeProposalPricingDetails(source.pricingDetails),
    };
  });
}
