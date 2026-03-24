"use client";

import { ProposalProduct } from "@/types/proposal";
import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { AmbienteProduct } from "@/types/automation";
import {
  ProposalProductPricingDetails,
  calculateProposalProductPricing,
  createDefaultProposalPricingDetails,
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

  if (!catalogItem) {
    const effectiveMarkup = product.markup || 0;
    return {
      ...product,
      pricingDetails: product.pricingDetails || { mode: "standard" },
      total: product.quantity * product.unitPrice * (1 + effectiveMarkup / 100),
    };
  }

  const calculated = calculateProposalProductPricing({
    price: catalogItem.price,
    markup: "markup" in catalogItem ? catalogItem.markup : String(product.markup || 0),
    pricingModel: "pricingModel" in catalogItem ? catalogItem.pricingModel : undefined,
    quantity: product.quantity,
    unitPrice: product.unitPrice,
    pricingDetails: product.pricingDetails,
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
