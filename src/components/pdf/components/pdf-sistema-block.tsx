import React from "react";
import { formatCurrency } from "@/utils/format-utils";
import { getContrastTextColor } from "@/utils/color-utils";

interface PdfProduct {
  productId: string;
  productName: string;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isExtra?: boolean;
}

interface PdfSistema {
  sistemaId: string;
  sistemaName: string;
  ambienteId: string;
  ambienteName: string;
  description?: string;
}

interface PdfSistemaBlockProps {
  sistema: PdfSistema;
  products: PdfProduct[];
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
    (sum: number, p: PdfProduct) => sum + p.total,
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
              {/* Ambiente tag using SVG for precise text centering in html2canvas */}
              {(() => {
                // Measure text for precise fitting with Icon
                // IMPORTANT: Must measure UPPERCASE text because CSS applies text-transform: uppercase
                const rawText = sistema.ambienteName || "Ambiente";
                const text = rawText.toUpperCase();
                const font = "700 12px ui-sans-serif, system-ui, sans-serif";

                const measure = (t: string, f: string) => {
                  if (typeof document === "undefined") return t.length * 8;
                  const c = document.createElement("canvas");
                  const ctx = c.getContext("2d");
                  if (!ctx) return t.length * 8;
                  ctx.font = f;
                  return ctx.measureText(t).width;
                };

                const measuredTextWidth = measure(text, font);
                // Multiplier to account for rendering diffs and ensure visual centering
                const textWidth = measuredTextWidth * 1.05;

                const iconSize = 12;
                const iconGap = 4;
                const padding = 36; // Increased padding slightly
                const contentWidth = iconSize + iconGap + textWidth;
                const svgWidth = Math.max(60, contentWidth + padding);

                // Calculate start X to center the content group (Icon + Text)
                // -2px visual correction to shift left
                const startX = ((svgWidth - contentWidth) / 2) - 2;
                const textColor = getContrastTextColor(primaryColor);

                return (
                  <svg
                    className="ambiente-tag mb-2"
                    width={svgWidth}
                    height="22"
                    style={{
                      overflow: "visible",
                      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.1))",
                      display: "block",
                    }}
                  >
                    <rect
                      rx="11"
                      ry="11"
                      width={svgWidth}
                      height="22"
                      fill={primaryColor}
                    />

                    {/* Content Group */}
                    <g transform={`translate(${startX}, 0)`}>
                      {/* Map Pin Icon (Scaled to ~12px) */}
                      <g transform="translate(0, 5) scale(0.5)">
                        <path
                          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                          fill={textColor}
                        />
                      </g>

                      {/* Text */}
                      <text
                        x={iconSize + iconGap}
                        y="50%"
                        dominantBaseline="central"
                        textAnchor="start"
                        fill={textColor}
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {text}
                      </text>
                    </g>
                  </svg>
                );
              })()}
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
          {products.map((product: PdfProduct, idx: number) => {
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
                          crossOrigin="anonymous"
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Product Info */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Product Name & Extra Tag - Unified SVG Strategy */
                      /* Uses canvas measurement to ensure consistent gap between Text and Badge */
                    }
                    {product.isExtra ? (
                      (() => {
                        const text = product.productName;
                        // Use the exact font stack used in CSS: font-semibold (600) text-base (16px)
                        // We assume standard sans-serif fallback if 'Inter' isn't explicitly measuring similarly
                        const font = "600 16px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

                        // Helper inside scope or defined outside. Defining helper inline (or use the one we added if it was outside)
                        // Since I can't add function outside easily in this replace, I'll inline a safe check
                        const measure = (t: string, f: string) => {
                          if (typeof document === "undefined") return t.length * 8;
                          const c = document.createElement("canvas");
                          const ctx = c.getContext("2d");
                          if (!ctx) return t.length * 8;
                          ctx.font = f;
                          return ctx.measureText(t).width;
                        };

                        const textWidth = measure(text, font);
                        const badgeWidth = 60;
                        const gap = 16; // Adjusted for better spacing
                        const totalWidth = textWidth + badgeWidth + gap + 4; // +4 buffer

                        return (
                          <svg
                            width={totalWidth}
                            height="24"
                            style={{ display: "block", overflow: "visible" }}
                          >
                            <text
                              x="0"
                              y="50%"
                              dominantBaseline="central"
                              fill="#111827"
                              style={{
                                fontSize: "16px",
                                fontWeight: 600,
                                fontFamily: "inherit",
                              }}
                            >
                              {text}
                            </text>

                            <g transform={`translate(${textWidth + gap}, 0)`}>
                              <rect
                                x="0"
                                y="2"
                                rx="4"
                                ry="4"
                                width={badgeWidth}
                                height="20"
                                fill="#dbeafe"
                                stroke="#bfdbfe"
                                strokeWidth="1"
                              />
                              <text
                                x={badgeWidth / 2}
                                y="50%" // Aligned same as title
                                dominantBaseline="central"
                                textAnchor="middle"
                                fill="#1d4ed8"
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                Extra
                              </text>
                            </g>
                          </svg>
                        );
                      })()
                    ) : (
                      <h4 className="font-semibold text-gray-900 text-base leading-none m-0 p-0">
                        {product.productName}
                      </h4>
                    )}

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
    </div >
  );
}
