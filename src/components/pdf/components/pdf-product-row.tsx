import React from "react";
import { PdfItemTypeBadge } from "./pdf-item-type-badge";
import { Package, Wrench } from "lucide-react";
import type { TenantNiche } from "@/types";
import type { ProposalProductPricingDetails } from "@/lib/product-pricing";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";
import {
  hasCortinasAwareProductFooterContent,
  PdfCortinasAwareProductFooter,
} from "./pdf-sistema-primitives";

interface ProductData {
  productId: string;
  productName: string;
  itemType?: "product" | "service";
  productDescription?: string;
  productImages?: string[];
  productImage?: string;
  description?: string;
  category?: string;
  manufacturer?: string;
  quantity: number;
  unitPrice: number;
  markup?: number;
  total: number;
  pricingDetails?: ProposalProductPricingDetails;
}

interface PdfProductRowProps {
  product: ProductData;
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentStyles: any;
  pdfDisplaySettings?: PdfDisplaySettings;
  tenantNiche?: TenantNiche | null;
}

/**
 * Renders a single product row in PDF
 */
export function PdfProductRow({
  product,
  index,
  contentStyles,
  pdfDisplaySettings,
  tenantNiche,
}: PdfProductRowProps) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const imageSources =
    product.productImages?.filter(
      (image) => typeof image === "string" && image,
    ) || [];
  const hasImage = imageSources.length > 0 || Boolean(product.productImage);
  const PlaceholderIcon = product.itemType === "service" ? Wrench : Package;

  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-lg border mb-4 break-inside-avoid"
      style={
        index % 2 === 0
          ? contentStyles.productCardAlt
          : contentStyles.productCard
      }
    >
      {settings.showProductImages && (
        <div className="flex flex-row gap-4 overflow-hidden justify-center mb-4">
          {imageSources.length > 0 ? (
            imageSources.map((img: string, idx: number) => (
              <div
                key={idx}
                className="w-48 h-48 bg-white rounded-lg border overflow-hidden shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`Product ${idx}`}
                  className="w-full h-full object-contain p-2"
                />
              </div>
            ))
          ) : hasImage ? (
            <div className="w-48 h-48 bg-white rounded-lg border overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.productImage || ""}
                alt={product.description || ""}
                className="w-full h-full object-contain p-2"
              />
            </div>
          ) : (
            <div className="w-48 h-48 bg-white rounded-lg border overflow-hidden shrink-0 flex items-center justify-center">
              <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center border">
                <PlaceholderIcon className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col gap-2">
        <div>
          <div className="mb-2">
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-lg font-bold text-gray-900 leading-tight">
                  {product.productName}
                </span>
              </div>
              <div className="shrink-0 flex items-start">
                <PdfItemTypeBadge itemType={product.itemType || "product"} />
              </div>
            </div>

            {(product.category || product.manufacturer) && (
              <div className="flex gap-2 mt-1">
                {product.category && (
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                    {product.category}
                  </span>
                )}
                {product.manufacturer && product.itemType !== "service" && (
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                    {product.manufacturer}
                  </span>
                )}
              </div>
            )}
          </div>

          {settings.showProductDescriptions && product.productDescription && (
            <div
              className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed"
              style={contentStyles.productSub}
            >
              {product.productDescription}
            </div>
          )}
        </div>

        {hasCortinasAwareProductFooterContent({
          product,
          tenantNiche,
          showProductPrices: settings.showProductPrices,
          showProductMeasurements: settings.showProductMeasurements,
          showProductQuantities: settings.showProductQuantities,
        }) && (
          <div className="mt-4 pt-3 border-t flex justify-between items-end">
            <div className="text-sm text-gray-400" />
            <div className="text-right">
              <div className="inline-flex flex-col items-end">
                <PdfCortinasAwareProductFooter
                  product={product}
                  tenantNiche={tenantNiche}
                  showProductPrices={settings.showProductPrices}
                  showProductMeasurements={settings.showProductMeasurements}
                  showProductQuantities={settings.showProductQuantities}
                  primaryColor={
                    typeof contentStyles?.total?.color === "string"
                      ? contentStyles.total.color
                      : undefined
                  }
                  grayTextClassName="text-xs text-gray-500 mb-1"
                  totalTextClassName="text-lg font-bold whitespace-nowrap"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
