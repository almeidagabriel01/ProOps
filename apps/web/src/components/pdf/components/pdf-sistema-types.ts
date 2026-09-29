import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";
import type { ProposalProductPricingDetails } from "@/lib/product-pricing";
import type { TenantNiche } from "@/types";

export interface PdfProduct {
  productId: string;
  itemType?: "product" | "service";
  productName: string;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  markup?: number;
  total: number;
  pricingDetails?: ProposalProductPricingDetails;
  isExtra?: boolean;
  isMonthly?: boolean;
  systemInstanceId?: string;
  _isInactive?: boolean;
  _isGhost?: boolean;
}

export interface PdfAmbiente {
  ambienteId?: string;
  ambienteName: string;
  description?: string;
}

export interface PdfSistema {
  sistemaId: string;
  sistemaName: string;
  ambienteId?: string;
  ambienteName?: string;
  description?: string;
  ambientes?: PdfAmbiente[];
}

export interface PdfSistemaBlockProps {
  sistema: PdfSistema;
  products: PdfProduct[];
  primaryColor: string;
  pdfDisplaySettings?: PdfDisplaySettings;
  tenantNiche?: TenantNiche | null;
}

export function resolvePdfDisplaySettings(
  pdfDisplaySettings?: PdfDisplaySettings,
): PdfDisplaySettings {
  return { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
}

/**
 * Os locais do grupo. `placeFallbackName` nomeia o local de uma seleção
 * legada sem nome ("Ambiente", "Área"): vem do vocabulário do nicho, que o
 * chamador resolve pelo `tenantNiche` (o PDF roda sem TenantProvider).
 */
export function resolveSistemaAmbientes(
  sistema: PdfSistema,
  placeFallbackName: string,
): PdfAmbiente[] {
  if (sistema.ambientes && sistema.ambientes.length > 0) {
    return sistema.ambientes;
  }

  return [
    {
      ambienteName: sistema.ambienteName || placeFallbackName,
      ambienteId: sistema.ambienteId,
    },
  ];
}

export function resolveProductImages(product: PdfProduct): string[] {
  if (product.productImages?.length) {
    return product.productImages;
  }
  if (product.productImage) {
    return [product.productImage];
  }
  return [];
}
