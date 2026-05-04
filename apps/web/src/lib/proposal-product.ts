"use client";

import { ProposalProduct } from "@/types/proposal";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { AmbienteProduct } from "@/types/automation";
import {
  ProposalProductPricingDetails,
  calculateSellingPrice,
  calculateProposalProductPricing,
  createDefaultProposalPricingDetails,
  getChargeableQuantityFromPricingDetails,
  hydrateProposalPricingDetails,
  roundPricingValue,
} from "@/lib/product-pricing";

type CatalogItem = Product | Service;

type BuildProposalProductOptions = {
  lineItemId?: string;
  quantity?: number;
  pricingDetails?: ProposalProductPricingDetails;
  systemInstanceId?: string;
  isExtra?: boolean;
  status?: "active" | "inactive";
};

function createIdSegment(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createLineItemId(prefix: "amb" | "prop" = "prop"): string {
  return `${prefix}-${createIdSegment()}`;
}

export function ensureProposalProductLineItemId(
  product: ProposalProduct,
): ProposalProduct {
  if (typeof product.lineItemId === "string" && product.lineItemId.trim()) {
    return product;
  }

  return {
    ...product,
    lineItemId: createLineItemId("prop"),
  };
}

export function ensureAmbienteProductLineItemId(
  product: AmbienteProduct,
): AmbienteProduct {
  if (typeof product.lineItemId === "string" && product.lineItemId.trim()) {
    return product;
  }

  return {
    ...product,
    lineItemId: createLineItemId("amb"),
  };
}

function getCatalogItemMarkup(item: CatalogItem): number {
  if ((item.itemType || "product") === "service") {
    return 0;
  }

  return Number.parseFloat("manufacturer" in item ? item.markup || "0" : "0") || 0;
}

function resolveProposalSnapshotMarkup(
  product: ProposalProduct,
  unitPrice: number,
): number {
  if ((product.itemType || "product") === "service") {
    return 0;
  }

  if (typeof product.markup === "number" && Number.isFinite(product.markup)) {
    return roundPricingValue(Math.max(0, product.markup), 4);
  }

  const quantity = Math.max(0, Number(product.quantity || 0));
  const total = Math.max(0, Number(product.total || 0));

  if (quantity > 0 && unitPrice > 0) {
    const sellingPerUnit = total / quantity;
    return roundPricingValue(Math.max(0, ((sellingPerUnit / unitPrice) - 1) * 100), 4);
  }

  return 0;
}

export function buildProposalProductFromCatalog(
  item: CatalogItem,
  options: BuildProposalProductOptions = {},
): ProposalProduct {
  const itemType = item.itemType || "product";
  const defaultPricingDetails =
    options.pricingDetails || createDefaultProposalPricingDetails(item);
  const calculated = calculateProposalProductPricing({
    price: item.price,
    markup: itemType === "service" ? 0 : getCatalogItemMarkup(item),
    pricingModel: "pricingModel" in item ? item.pricingModel : undefined,
    quantity: options.quantity ?? 1,
    unitPrice: Number.parseFloat(item.price) || 0,
    pricingDetails: defaultPricingDetails,
  });

  return {
    lineItemId: options.lineItemId || createLineItemId("prop"),
    productId: item.id,
    itemType,
    productName: item.name,
    productImage: item.images?.[0] || item.image || "",
    productImages: item.images?.length
      ? item.images
      : item.image
        ? [item.image]
        : [],
    productDescription: item.description || "",
    quantity: calculated.quantity,
    unitPrice:
      itemType === "service"
        ? Number.parseFloat(item.price) || 0
        : calculated.unitPrice,
    markup: itemType === "service" ? 0 : calculated.markup,
    pricingDetails:
      itemType === "service" ? { mode: "standard" } : calculated.pricingDetails,
    total:
      itemType === "service"
        ? (options.quantity ?? 1) * (Number.parseFloat(item.price) || 0)
        : calculated.total,
    manufacturer: "manufacturer" in item ? item.manufacturer : undefined,
    category: item.category,
    systemInstanceId: options.systemInstanceId,
    ambienteInstanceId: options.systemInstanceId,
    isExtra: options.isExtra,
    status: options.status || "active",
  };
}

export function buildProposalProductFromTemplate(
  templateItem: AmbienteProduct,
  catalogItem: CatalogItem | undefined,
  systemInstanceId: string,
): ProposalProduct {
  const itemType = templateItem.itemType || "product";
  const fallbackCatalogItem: CatalogItem =
    catalogItem ||
    ({
      id: templateItem.productId,
      tenantId: "",
      name: templateItem.productName || "Produto",
      description: "",
      price: "0",
      markup: "0",
      category: "",
      manufacturer: "",
      inventoryValue: 0,
      stock: 0,
      images: [],
      itemType,
    } as Product);

  return buildProposalProductFromCatalog(fallbackCatalogItem, {
    lineItemId: templateItem.lineItemId || createLineItemId("prop"),
    quantity: templateItem.quantity,
    pricingDetails: templateItem.pricingDetails,
    systemInstanceId,
    isExtra: false,
    status: templateItem.status || "active",
  });
}

export function recalculateProposalProduct(
  product: ProposalProduct,
  catalogItem?: CatalogItem,
): ProposalProduct {
  const itemType = product.itemType || "product";

  if (itemType === "service") {
    return {
      ...product,
      pricingDetails: { mode: "standard" },
      markup: 0,
      total: product.quantity * product.unitPrice,
    };
  }

  if (product.priceManuallyEdited) {
    const pricingDetails = hydrateProposalPricingDetails(product);
    const storedUnitPrice = Math.max(0, Number(product.unitPrice || 0));
    const markup = roundPricingValue(Math.max(0, Number(product.markup || 0)));
    const previousQuantity = roundPricingValue(
      Math.max(0, Number(product.quantity || 0)),
      4,
    );
    const quantity = getChargeableQuantityFromPricingDetails(
      pricingDetails,
      Number(product.quantity || 0),
    );
    const manualTotal = roundPricingValue(Math.max(0, Number(product.total || 0)));
    const markupFactor = 1 + markup / 100;
    const sellingPrice =
      previousQuantity > 0
        ? manualTotal / previousQuantity
        : calculateSellingPrice(storedUnitPrice, markup);
    const unitPrice =
      markupFactor > 0
        ? roundPricingValue(sellingPrice / markupFactor, 8)
        : 0;

    return {
      ...product,
      quantity,
      unitPrice,
      markup,
      pricingDetails,
      total: roundPricingValue(quantity * sellingPrice),
    };
  }

  if (!catalogItem) {
    const pricingDetails = hydrateProposalPricingDetails(product);
    const effectiveMarkup = product.markup || 0;
    return {
      ...product,
      pricingDetails,
      total: product.quantity * product.unitPrice * (1 + effectiveMarkup / 100),
    };
  }

  const calculated = calculateProposalProductPricing({
    price: catalogItem.price,
    markup: "markup" in catalogItem ? catalogItem.markup : String(product.markup || 0),
    pricingModel: "pricingModel" in catalogItem ? catalogItem.pricingModel : undefined,
    quantity: product.quantity,
    unitPrice: product.unitPrice,
    pricingDetails: hydrateProposalPricingDetails(product),
  });

  return {
    ...product,
    quantity: calculated.quantity,
    unitPrice: calculated.unitPrice,
    markup: calculated.markup,
    pricingDetails: calculated.pricingDetails,
    total: calculated.total,
  };
}

export function syncProposalProductWithCatalogSnapshot(
  product: ProposalProduct,
  catalogItem?: CatalogItem,
): ProposalProduct {
  const normalizedProduct = ensureProposalProductLineItemId(product);
  const resolvedItemType =
    (catalogItem?.itemType || normalizedProduct.itemType || "product") as
      | "product"
      | "service";
  const isService = resolvedItemType === "service";
  const fallbackUnitPrice =
    catalogItem && typeof catalogItem.price !== "undefined"
      ? Number.parseFloat(String(catalogItem.price || "0")) || 0
      : 0;
  const unitPrice =
    typeof normalizedProduct.unitPrice === "number" &&
    Number.isFinite(normalizedProduct.unitPrice)
      ? roundPricingValue(
          Math.max(0, normalizedProduct.unitPrice),
          normalizedProduct.priceManuallyEdited ? 8 : 4,
        )
      : roundPricingValue(Math.max(0, fallbackUnitPrice), 4);
  const markup = isService
    ? 0
    : resolveProposalSnapshotMarkup(
        { ...normalizedProduct, itemType: resolvedItemType },
        unitPrice,
      );
  const recalculated = recalculateProposalProduct({
    ...normalizedProduct,
    itemType: resolvedItemType,
    unitPrice,
    markup,
  });

  if (!catalogItem) {
    return recalculated;
  }

  const catalogImages = Array.isArray(catalogItem.images)
    ? catalogItem.images.filter(Boolean)
    : [];
  const fallbackImage =
    catalogImages[0] ||
    catalogItem.image ||
    recalculated.productImage ||
    "";

  return {
    ...recalculated,
    itemType: resolvedItemType,
    productName: catalogItem.name || recalculated.productName,
    productImage: fallbackImage,
    productImages:
      catalogImages.length > 0
        ? catalogImages
        : fallbackImage
          ? [fallbackImage]
          : recalculated.productImages || [],
    productDescription:
      catalogItem.description || recalculated.productDescription || "",
    manufacturer:
      ("manufacturer" in catalogItem ? catalogItem.manufacturer : undefined) ||
      recalculated.manufacturer,
    category: catalogItem.category || recalculated.category,
  };
}

export function applyManualProposalProductUnitPrice(
  product: ProposalProduct,
  nextUnitPrice: number,
): ProposalProduct {
  const itemType = product.itemType || "product";
  const pricingDetails = hydrateProposalPricingDetails(product);
  const quantity = getChargeableQuantityFromPricingDetails(
    pricingDetails,
    Number(product.quantity || 0),
  );
  const unitPrice = roundPricingValue(Math.max(0, nextUnitPrice), 8);
  const markup = roundPricingValue(Math.max(0, Number(product.markup || 0)), 4);
  const sellingPrice =
    itemType === "service"
      ? unitPrice
      : calculateSellingPrice(unitPrice, markup);

  return {
    ...product,
    quantity,
    unitPrice,
    pricingDetails,
    priceManuallyEdited: true,
    total: roundPricingValue(quantity * sellingPrice),
  };
}

export function resetProposalProductPriceToDefault(
  product: ProposalProduct,
  catalogItem?: CatalogItem,
): ProposalProduct {
  const itemType = product.itemType || "product";

  if (itemType === "service") {
    const defaultUnitPrice = catalogItem
      ? Number.parseFloat(String(catalogItem.price || "0")) || 0
      : Math.max(0, Number(product.unitPrice || 0));
    const quantity = roundPricingValue(Math.max(0, Number(product.quantity || 0)), 4);

    return {
      ...product,
      pricingDetails: { mode: "standard" },
      markup: 0,
      unitPrice: roundPricingValue(defaultUnitPrice, 8),
      priceManuallyEdited: false,
      total: roundPricingValue(quantity * defaultUnitPrice),
    };
  }

  if (!catalogItem) {
    return {
      ...product,
      priceManuallyEdited: false,
    };
  }

  return recalculateProposalProduct(
    {
      ...product,
      priceManuallyEdited: false,
    },
    catalogItem,
  );
}
