import React from "react";
import { formatCurrency } from "@/utils/format-utils";
import { getContrastTextColor } from "@/utils/color-utils";

interface PdfSistemaBlockProps {
  sistema: any;
  products: any[];
  primaryColor: string;
}

/**
 * Renders a complete system block with header, products, and subtotal
 * Used for automation niche proposals
 */
export function PdfSistemaBlock({
  sistema,
  products,
  primaryColor,
}: PdfSistemaBlockProps) {
  const sistemaSubtotal = products.reduce(
    (sum: number, p: any) => sum + p.total,
    0
  );

  return (
    <div className="mt-6 mb-4">
      <div
        className="rounded-xl border-2 overflow-hidden"
        style={{ borderColor: primaryColor }}
      >
        {/* Header */}
        <div
          className="p-5"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)`,
            borderBottom: `2px solid ${primaryColor}30`,
          }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span
                className="ambiente-tag text-xs font-bold uppercase tracking-wider rounded-full shadow mb-2"
                style={{
                  backgroundColor: primaryColor,
                  color: getContrastTextColor(primaryColor),
                  display: "inline-block",
                  height: "22px",
                  lineHeight: "22px",
                  padding: "0 12px",
                }}
              >
                {sistema.ambienteName}
              </span>
              <h3
                className="text-2xl font-bold"
                style={{ color: primaryColor }}
              >
                {sistema.sistemaName}
              </h3>
              {sistema.description && (
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {sistema.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="p-4 space-y-3 bg-white">
          {products.map((product: any, idx: number) => {
            const allImages = product.productImages?.length
              ? product.productImages
              : product.productImage
                ? [product.productImage]
                : [];

            return (
              <div
                key={`${product.productId}-${idx}`}
                className="p-4 rounded-lg border"
                style={{
                  backgroundColor: product.isExtra
                    ? "#eff6ff"
                    : idx % 2 === 0
                      ? "#f9fafb"
                      : "#ffffff",
                  borderColor: product.isExtra ? "#bfdbfe" : "#e5e7eb",
                }}
              >
                {/* Product Images */}
                {allImages.length > 0 && (
                  <div className="flex gap-2 mb-3 justify-center flex-wrap">
                    {allImages.map((imgSrc: string, imgIdx: number) => (
                      <div
                        key={imgIdx}
                        className="w-20 h-20 bg-white rounded-lg border overflow-hidden flex-shrink-0 shadow-sm"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imgSrc}
                          alt=""
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Product Info */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">
                        {product.productName}
                      </h4>
                      {product.isExtra && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                          Extra
                        </span>
                      )}
                    </div>
                    {product.productDescription && (
                      <p className="text-xs text-gray-500">
                        {product.productDescription}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span
                      className="font-bold text-lg"
                      style={{ color: primaryColor }}
                    >
                      {product.quantity}x {formatCurrency(product.total)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Subtotal */}
          <div
            className="flex justify-between items-center pt-3 mt-2"
            style={{ borderTop: `2px dashed ${primaryColor}30` }}
          >
            <span className="font-semibold text-gray-700">
              Subtotal do Sistema:
            </span>
            <span className="text-xl font-bold" style={{ color: primaryColor }}>
              {formatCurrency(sistemaSubtotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
