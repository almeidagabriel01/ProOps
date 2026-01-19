import React from "react";
import { formatCurrency } from "@/utils/format-utils";

interface ProductData {
  productName: string;
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
}

interface PdfProductRowProps {
  product: ProductData;
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentStyles: any;
}

/**
 * Renders a single product row in PDF
 */
export function PdfProductRow({
  product,
  index,
  contentStyles,
}: PdfProductRowProps) {
  // Calculate selling price (unitPrice with markup applied)
  const sellingPrice = product.unitPrice * (1 + (product.markup || 0) / 100);

  return (
    <div
      className="flex flex-col gap-4 p-6 rounded-lg border mb-4 break-inside-avoid"
      style={
        index % 2 === 0
          ? contentStyles.productCardAlt
          : contentStyles.productCard
      }
    >
      {/* Image Row - Horizontal */}
      <div className="flex flex-row gap-4 overflow-hidden justify-center mb-4">
        {product.productImages && product.productImages.length > 0 ? (
          product.productImages.map((img: string, idx: number) => (
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
        ) : product.productImage || product.productImages?.[0] ? (
          <div className="w-48 h-48 bg-white rounded-lg border overflow-hidden shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.productImages?.[0] || product.productImage || ""}
              alt={product.description || ""}
              className="w-full h-full object-contain p-2"
            />
          </div>
        ) : null}
      </div>

      {/* Content Column */}
      <div className="flex-1 flex flex-col gap-2">
        <div>
          <div className="mb-2">
            <div className="flex justify-between items-start">
              <span className="text-lg font-bold text-gray-900 leading-tight">
                {product.productName}
              </span>
            </div>

            {/* Category/Manufacturer Badges */}
            {(product.category || product.manufacturer) && (
              <div className="flex gap-2 mt-1">
                {product.category && (
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                    {product.category}
                  </span>
                )}
                {product.manufacturer && (
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                    {product.manufacturer}
                  </span>
                )}
              </div>
            )}
          </div>

          {product.productDescription && (
            <div
              className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed"
              style={contentStyles.productSub}
            >
              {product.productDescription}
            </div>
          )}
        </div>

        {/* Footer / Specs */}
        <div className="mt-4 pt-3 border-t flex justify-between items-end">
          <div className="text-sm text-gray-400" />
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">
              {product.quantity} un. x {formatCurrency(sellingPrice)}
            </div>
            <div
              className="text-lg font-bold whitespace-nowrap"
              style={contentStyles.total}
            >
              {formatCurrency(product.total)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
