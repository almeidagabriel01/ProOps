import React from "react";
import { formatCurrency } from "@/utils/format-utils";
import { getContrastTextColor } from "@/utils/color-utils";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";

interface PdfProduct {
  productId: string;
  productName: string;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  _isInactive?: boolean;
  _isGhost?: boolean;
}

interface PdfExtraProductsBlockProps {
  products: PdfProduct[];
  primaryColor: string;
  pdfDisplaySettings?: PdfDisplaySettings;
}

/**
 * Renders extra products block (products not tied to systems)
 */
export function PdfExtraProductsBlock({
  products,
  primaryColor,
  pdfDisplaySettings,
}: PdfExtraProductsBlockProps) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const nonGhostProducts = products.filter(
    (product) => Number(product.quantity || 0) > 0 && !product._isGhost,
  );
  const extraSubtotal = nonGhostProducts.reduce(
    (sum: number, p: PdfProduct) => sum + p.total,
    0,
  );
  const visibleProducts = nonGhostProducts.filter(
    (product) => !product._isInactive,
  );

  return (
    <div className="mt-12 mb-4">
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
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div className="flex-1">
              {/* Avulso tag using SVG for precise text centering in html2canvas */}
              <svg
                width="90"
                height="22"
                style={{
                  overflow: "visible",
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                <rect
                  rx="11"
                  ry="11"
                  width="90"
                  height="22"
                  fill={primaryColor}
                />
                <text
                  x="50%"
                  y="50%"
                  dominantBaseline="central"
                  textAnchor="middle"
                  fill={getContrastTextColor(primaryColor)}
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  📍 Avulso
                </text>
              </svg>
              <h3
                className="text-2xl font-bold"
                style={{ color: primaryColor }}
              >
                Produtos Extras
              </h3>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                Itens adicionais não vinculados a sistemas específicos
              </p>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="p-4 bg-white">
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "6px",
              tableLayout: "fixed",
            }}
          >
            <tbody>
              {Array.from(
                { length: Math.ceil(visibleProducts.length / 2) },
                (_, rowIdx) => {
                  const left = visibleProducts[rowIdx * 2];
                  const right = visibleProducts[rowIdx * 2 + 1];
                  return (
                    <tr key={rowIdx}>
                      {right ? (
                        <>
                          <td
                            style={{
                              verticalAlign: "top",
                              width: "50%",
                              padding: 0,
                            }}
                          >
                            {left && (
                              <div
                                className="flex items-center gap-2 p-3 rounded-lg border"
                                style={{
                                  backgroundColor:
                                    (rowIdx * 2) % 2 === 0
                                      ? "#f9fafb"
                                      : "#ffffff",
                                  borderColor: "#e5e7eb",
                                }}
                              >
                                {settings.showProductImages &&
                                  (left.productImage ||
                                    (left.productImages &&
                                      left.productImages.length > 0)) && (
                                    <div className="w-16 h-16 bg-white rounded-lg border overflow-hidden shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={
                                          left.productImages?.[0] ||
                                          left.productImage
                                        }
                                        alt=""
                                        className="w-full h-full object-contain p-1"
                                      />
                                    </div>
                                  )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900 truncate">
                                    {left.productName}
                                  </h4>
                                  {settings.showProductPrices ? (
                                    <p className="text-sm text-gray-500">
                                      {left.quantity} un. ×{" "}
                                      {formatCurrency(left.unitPrice)}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-500">
                                      Qtd: {left.quantity}
                                    </p>
                                  )}
                                </div>
                                {settings.showProductPrices && (
                                  <div className="text-right">
                                    <span className="font-bold text-lg text-gray-700">
                                      {formatCurrency(left.total)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              verticalAlign: "top",
                              width: "50%",
                              padding: 0,
                            }}
                          >
                            {right && (
                              <div
                                className="flex items-center gap-2 p-3 rounded-lg border"
                                style={{
                                  backgroundColor:
                                    (rowIdx * 2 + 1) % 2 === 0
                                      ? "#f9fafb"
                                      : "#ffffff",
                                  borderColor: "#e5e7eb",
                                }}
                              >
                                {settings.showProductImages &&
                                  (right.productImage ||
                                    (right.productImages &&
                                      right.productImages.length > 0)) && (
                                    <div className="w-16 h-16 bg-white rounded-lg border overflow-hidden shrink-0">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={
                                          right.productImages?.[0] ||
                                          right.productImage
                                        }
                                        alt=""
                                        className="w-full h-full object-contain p-1"
                                      />
                                    </div>
                                  )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900 truncate">
                                    {right.productName}
                                  </h4>
                                  {settings.showProductPrices ? (
                                    <p className="text-sm text-gray-500">
                                      {right.quantity} un. ×{" "}
                                      {formatCurrency(right.unitPrice)}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-500">
                                      Qtd: {right.quantity}
                                    </p>
                                  )}
                                </div>
                                {settings.showProductPrices && (
                                  <div className="text-right">
                                    <span className="font-bold text-lg text-gray-700">
                                      {formatCurrency(right.total)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </>
                      ) : (
                        <td
                          colSpan={2}
                          style={{ verticalAlign: "top", padding: 0 }}
                        >
                          {left && (
                            <div
                              className="flex items-center gap-2 p-3 rounded-lg border"
                              style={{
                                backgroundColor:
                                  (rowIdx * 2) % 2 === 0
                                    ? "#f9fafb"
                                    : "#ffffff",
                                borderColor: "#e5e7eb",
                              }}
                            >
                              {settings.showProductImages &&
                                (left.productImage ||
                                  (left.productImages &&
                                    left.productImages.length > 0)) && (
                                  <div className="w-16 h-16 bg-white rounded-lg border overflow-hidden shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={
                                        left.productImages?.[0] ||
                                        left.productImage
                                      }
                                      alt=""
                                      className="w-full h-full object-contain p-1"
                                    />
                                  </div>
                                )}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 truncate">
                                  {left.productName}
                                </h4>
                                {settings.showProductPrices ? (
                                  <p className="text-sm text-gray-500">
                                    {left.quantity} un. ×{" "}
                                    {formatCurrency(left.unitPrice)}
                                  </p>
                                ) : (
                                  <p className="text-sm text-gray-500">
                                    Qtd: {left.quantity}
                                  </p>
                                )}
                              </div>
                              {settings.showProductPrices && (
                                <div className="text-right">
                                  <span className="font-bold text-lg text-gray-700">
                                    {formatCurrency(left.total)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>

          {/* Subtotal - conditionally rendered */}
          {settings.showSubtotals && (
            <div
              className="flex justify-between items-center pt-3 mt-2"
              style={{ borderTop: "2px dashed #d1d5db" }}
            >
              <span className="font-semibold text-gray-700">
                Subtotal Extras:
              </span>
              <span className="text-xl font-bold text-gray-700">
                {formatCurrency(extraSubtotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
