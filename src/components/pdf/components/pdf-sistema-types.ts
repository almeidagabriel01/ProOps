import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";

export interface PdfProduct {
  productId: string;
  itemType?: "product" | "service";
  productName: string;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isExtra?: boolean;
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
}

export function resolvePdfDisplaySettings(
  pdfDisplaySettings?: PdfDisplaySettings,
): PdfDisplaySettings {
  return { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
}

export function resolveSistemaAmbientes(sistema: PdfSistema): PdfAmbiente[] {
  if (sistema.ambientes && sistema.ambientes.length > 0) {
    return sistema.ambientes;
  }

  return [
    {
      ambienteName: sistema.ambienteName || "Ambiente",
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
