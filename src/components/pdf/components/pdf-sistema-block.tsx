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
  isExtra?: boolean;
  systemInstanceId?: string;
}

interface PdfSistema {
  sistemaId: string;
  sistemaName: string;
  // Legacy fields (optional for backward compat)
  ambienteId?: string;
  ambienteName?: string;
  description?: string;
  ambientes?: {
    ambienteId: string;
    ambienteName: string;
  }[];
}

interface PdfSistemaBlockProps {
  sistema: PdfSistema;
  products: PdfProduct[];
  primaryColor: string;
  pdfDisplaySettings?: PdfDisplaySettings;
}

/**
 * Renders a complete system block with header, products, and subtotal
 * Used for automation niche proposals
 */
export function PdfSistemaBlock({
  sistema,
  products,
  primaryColor,
  pdfDisplaySettings,
}: PdfSistemaBlockProps) {
  // Merge with defaults
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const sistemaSubtotal = products.reduce(
    (sum: number, p: PdfProduct) => sum + p.total,
    0,
  );

  return (
    <div className="mt-16 mb-6 break-inside-avoid">
      <div
        className="rounded-xl border-2 overflow-hidden"
        style={{ borderColor: primaryColor }}
      >
        {/* Header - Compact */}
        <div
          className="p-4"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)`,
            borderBottom: `2px solid ${primaryColor}30`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center shadow-md shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6 text-white"
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
              <h3
                className="text-xl font-bold"
                style={{ color: primaryColor, margin: 0, padding: 0, lineHeight: "1.2", display: "block" }}
              >
                {sistema.sistemaName}
              </h3>
              <div style={{ height: "12px", width: "100%", display: "block", fontSize: "0", lineHeight: "0" }}>&nbsp;</div>
              <div className="flex items-center flex-wrap">
                {(sistema.ambientes && sistema.ambientes.length > 0
                  ? sistema.ambientes
                  : [
                      {
                        ambienteName: sistema.ambienteName || "Ambiente",
                        ambienteId: sistema.ambienteId,
                      },
                    ]
                ).map((amb, i) => (
                  <table
                    key={`${amb.ambienteId}-${i}`}
                    cellPadding="0"
                    cellSpacing="0"
                    style={{
                      display: "inline-table",
                      margin: 0,
                      padding: 0,
                      borderCollapse: "separate",
                      borderSpacing: 0,
                      marginBottom: "4px",
                    }}
                  >
                    <tbody>
                      <tr>
                        {/* THE TAG CONTENT */}
                        <td style={{ paddingRight: "8px" }}>
                          {/* Inner Table for content alignment (No Flexbox) */}
                          <table
                            cellPadding="0"
                            cellSpacing="0"
                            style={{
                              backgroundColor: `${primaryColor}15`,
                              color: primaryColor,
                              border: `1px solid ${primaryColor}40`,
                              borderRadius: "14px",
                              borderCollapse: "collapse",
                            }}
                          >
                            <tbody>
                              <tr>
                                <td
                                  style={{
                                    padding: "4px 6px 4px 10px",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  <svg
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    style={{ display: "block" }}
                                  >
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                  </svg>
                                </td>
                                <td
                                  style={{
                                    padding: "4px 12px 6px 0",
                                    verticalAlign: "middle",
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-block",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                      lineHeight: "1",
                                      // transform removed, relying on padding-bottom
                                    }}
                                  >
                                    {amb.ambienteName}
                                  </span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ))}
              </div>
              {sistema.description && (
                <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                  {sistema.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body: Ambientes & Products - Horizontal Compact Layout */}
        <div className="bg-white">
          {(sistema.ambientes && sistema.ambientes.length > 0
            ? sistema.ambientes
            : [
                {
                  ambienteName: sistema.ambienteName || "Ambiente",
                  ambienteId: sistema.ambienteId,
                },
              ]
          ).map((amb, index) => {
            const currentInstanceId = `${sistema.sistemaId}-${amb.ambienteId}`;

            // Filter products for this specific environment instance
            let scopeProducts = products.filter(
              (p) => p.systemInstanceId === currentInstanceId,
            );

            // Fallback for legacy: if no products matches instanceId and this is the only environment, show all
            if (
              scopeProducts.length === 0 &&
              (!sistema.ambientes || sistema.ambientes.length === 0)
            ) {
              scopeProducts = products;
            }

            if (scopeProducts.length === 0) return null;

            return (
              <div key={currentInstanceId}>
                {/* Ambiente Header (Sub-container) - Compact */}
                <PdfAmbienteHeader
                  ambienteName={amb.ambienteName || "Ambiente"}
                  primaryColor={primaryColor}
                  className={index > 0 ? "border-t border-dashed" : ""}
                />

                <div className="px-4 pb-3 space-y-2">
                  {scopeProducts.map((product: PdfProduct, idx: number) => {
                    const allImages = product.productImages?.length
                      ? product.productImages
                      : product.productImage
                        ? [product.productImage]
                        : [];

                    return (
                      <div
                        key={`${product.productId}-${idx}`}
                        className="p-3 rounded-lg border break-inside-avoid"
                        style={{
                          backgroundColor: product.isExtra
                            ? "#eff6ff"
                            : idx % 2 === 0
                              ? "#f9fafb"
                              : "#ffffff",
                          borderColor: product.isExtra ? "#bfdbfe" : "#e5e7eb",
                        }}
                      >
                        {/* PROFESSIONAL LAYOUT: Top to Bottom */}
                        <div className="space-y-2">
                          {/* Header Row: Title + Price */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Flexbox Layout - Better for html2canvas */}
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", minHeight: "20px" }}>
                                <h4 className="font-semibold text-gray-900 text-sm m-0 p-0" style={{ lineHeight: "20px", display: "flex", alignItems: "center" }}>
                                  {product.productName}
                                </h4>
                                {product.isExtra && (
                                  <div style={{ display: "flex", alignItems: "center", height: "20px" }}>
                                    <img
                                      src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='18'%3E%3Crect width='50' height='18' rx='4' fill='%23dbeafe' stroke='%23bfdbfe' stroke-width='1'/%3E%3Ctext x='25' y='13' font-family='system-ui,sans-serif' font-size='9' font-weight='bold' fill='%231d4ed8' text-anchor='middle' letter-spacing='0.5'%3EEXTRA%3C/text%3E%3C/svg%3E"
                                      alt="EXTRA"
                                      width="50"
                                      height="18"
                                      style={{ display: "block" }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {settings.showProductPrices ? (
                                <div className="space-y-0">
                                  <span className="text-[10px] text-gray-500 block">
                                    {product.quantity}x{" "}
                                    {formatCurrency(product.unitPrice)}
                                  </span>
                                  <span
                                    className="font-semibold text-sm"
                                    style={{ color: primaryColor }}
                                  >
                                    {formatCurrency(product.total)}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-medium text-xs text-gray-600">
                                  Qtd: {product.quantity}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Images Gallery - Grid Layout (max 4 per row) */}
                          {settings.showProductImages &&
                            allImages.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {allImages.map(
                                  (imgSrc: string, imgIdx: number) => (
                                    <div
                                      key={imgIdx}
                                      className="w-16 h-16 bg-white rounded border overflow-hidden shadow-sm"
                                      style={{
                                        flexBasis: "calc(25% - 4.5px)",
                                        maxWidth: "84px",
                                      }}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={imgSrc}
                                        alt=""
                                        className="w-full h-full object-contain p-0.5"
                                      />
                                    </div>
                                  ),
                                )}
                              </div>
                            )}

                          {/* Description */}
                          {settings.showProductDescriptions &&
                            product.productDescription && (
                              <p className="text-[10px] text-gray-600 leading-relaxed pt-1">
                                {product.productDescription}
                              </p>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Subtotal - conditionally rendered */}
          {settings.showSubtotals && (
            <div
              className="flex justify-between items-center px-4 pb-3 pt-2"
              style={{ borderTop: `2px dashed ${primaryColor}30` }}
            >
              <span className="font-semibold text-gray-700 text-sm">
                Subtotal do Sistema:
              </span>
              <span
                className="text-lg font-bold"
                style={{ color: primaryColor }}
              >
                {formatCurrency(sistemaSubtotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders just the sistema header (for page-break splitting)
 */
export function PdfSistemaHeader({
  sistema,
  primaryColor,
  isFirstOnPage = false,
}: {
  sistema: PdfSistema;
  primaryColor: string;
  isFirstOnPage?: boolean;
}) {
  return (
    <div className="">
      <div
        className="rounded-t-xl border-2 border-b-0 overflow-hidden"
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
              {/* Sistema Name - Primary Title */}
              <h3
                className="text-2xl font-bold mb-1"
                style={{ color: primaryColor }}
              >
                {sistema.sistemaName}
              </h3>
              {/* Ambiente tag */}
              {/* Ambiente tag - SVG Implementation for Perfect Roundness & Alignment */}
              {(() => {
                const rawText = sistema.ambienteName || "Ambiente";
                const text = rawText.toUpperCase();

                // --- Dynamic Centering Logic ---
                const charWidth = 6.5; // Average width for 10px bold font (S=6, A=6, L=5.5) -> 6.5 safe avg
                const textWidth = Math.ceil(text.length * charWidth);
                const iconSize = 10;
                const gap = 4;
                const paddingX = 8; // Left/Right padding

                const contentWidth = iconSize + gap + textWidth;
                const totalWidth = contentWidth + paddingX * 2;

                const iconX = paddingX;
                const textX = paddingX + iconSize + gap;

                return (
                  <div style={{ marginTop: "4px", display: "inline-block" }}>
                    <svg
                      width={totalWidth}
                      height="20"
                      viewBox={`0 0 ${totalWidth} 20`}
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ display: "block" }}
                    >
                      {/* Background Pill - Guaranteed Round */}
                      <rect
                        x="0.5"
                        y="0.5"
                        width={totalWidth - 1}
                        height="19"
                        rx="9.5"
                        fill={`${primaryColor}20`}
                        stroke={`${primaryColor}40`}
                      />

                      {/* Icon Group - Dynamic X */}
                      <g transform={`translate(${iconX}, 5)`}>
                        <path
                          d="M6 1C4.065 1 2.5 2.565 2.5 4.5C2.5 7.125 6 11 6 11S9.5 7.125 9.5 4.5C9.5 2.565 7.935 1 6 1ZM6 5.75C5.31 5.75 4.75 5.19 4.75 4.5C4.75 3.81 5.31 3.25 6 3.25C6.69 3.25 7.25 3.81 7.25 4.5C7.25 5.19 6.69 5.75 6 5.75Z"
                          fill="currentColor"
                          transform="scale(0.8)"
                          style={{ color: primaryColor }}
                        />
                      </g>

                      {/* Text Group - Dynamic X */}
                      <text
                        x={textX}
                        y="13.5" // visual center for 10px font
                        fill={primaryColor}
                        style={{
                          fontFamily: "ui-sans-serif, system-ui, sans-serif",
                          fontSize: "10px",
                          fontWeight: "bold",
                          letterSpacing: "0.02em", // slightly tighter tracking
                        }}
                      >
                        {text}
                      </text>
                    </svg>
                  </div>
                );
              })()}
              {sistema.description && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                  {sistema.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a single product within a sistema (for page-break splitting)
 */
export function PdfSistemaProduct({
  product,
  primaryColor,
  isFirst = false,

  pdfDisplaySettings,
}: {
  product: PdfProduct;
  primaryColor: string;
  isFirst?: boolean;
  isLast?: boolean;
  pdfDisplaySettings?: PdfDisplaySettings;
}) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const allImages = product.productImages?.length
    ? product.productImages
    : product.productImage
      ? [product.productImage]
      : [];

  return (
    <div
      className={`border-l-2 border-r-2 bg-white ${isFirst ? "pt-3" : ""}`}
      style={{ borderColor: primaryColor }}
    >
      <div className="px-4 pb-2">
        <div
          className="p-3 rounded-lg border break-inside-avoid"
          style={{
            backgroundColor: product.isExtra ? "#eff6ff" : "#f9fafb",
            borderColor: product.isExtra ? "#bfdbfe" : "#e5e7eb",
          }}
        >
          {/* PROFESSIONAL LAYOUT: Top to Bottom */}
          <div className="space-y-2">
            {/* Header Row: Title + Price */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Flexbox Layout - Better for html2canvas */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", minHeight: "20px" }}>
                  <h4 className="font-semibold text-gray-900 text-sm m-0 p-0" style={{ lineHeight: "20px", display: "flex", alignItems: "center" }}>
                    {product.productName}
                  </h4>
                  {product.isExtra && (
                    <div style={{ display: "flex", alignItems: "center", height: "20px" }}>
                      <img
                        src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='18'%3E%3Crect width='50' height='18' rx='4' fill='%23dbeafe' stroke='%23bfdbfe' stroke-width='1'/%3E%3Ctext x='25' y='13' font-family='system-ui,sans-serif' font-size='9' font-weight='bold' fill='%231d4ed8' text-anchor='middle' letter-spacing='0.5'%3EEXTRA%3C/text%3E%3C/svg%3E"
                        alt="EXTRA"
                        width="50"
                        height="18"
                        style={{ display: "block" }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0">
                {settings.showProductPrices ? (
                  <div className="space-y-0">
                    <span className="text-[10px] text-gray-500 block">
                      {product.quantity}x {formatCurrency(product.unitPrice)}
                    </span>
                    <span
                      className="font-semibold text-sm"
                      style={{ color: primaryColor }}
                    >
                      {formatCurrency(product.total)}
                    </span>
                  </div>
                ) : (
                  <span className="font-medium text-xs text-gray-600">
                    Qtd: {product.quantity}
                  </span>
                )}
              </div>
            </div>

            {/* Images Gallery - Grid Layout (max 4 per row) */}
            {settings.showProductImages && allImages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {allImages.map((imgSrc: string, imgIdx: number) => (
                  <div
                    key={imgIdx}
                    className="w-16 h-16 bg-white rounded border overflow-hidden shadow-sm"
                    style={{
                      flexBasis: "calc(25% - 4.5px)",
                      maxWidth: "84px",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imgSrc}
                      alt=""
                      className="w-full h-full object-contain p-0.5"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Description */}
            {settings.showProductDescriptions && product.productDescription && (
              <p className="text-[10px] text-gray-600 leading-relaxed pt-1">
                {product.productDescription}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the sistema footer/subtotal (for page-break splitting)
 */
export function PdfSistemaFooter({
  sistemaSubtotal,
  primaryColor,
  pdfDisplaySettings,
}: {
  sistemaSubtotal: number;
  primaryColor: string;
  pdfDisplaySettings?: PdfDisplaySettings;
}) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  return (
    <div
      className="rounded-b-xl border-2 border-t-0 overflow-hidden mb-4"
      style={{ borderColor: primaryColor }}
    >
      <div className="p-4 bg-white">
        {settings.showSubtotals && (
          <div
            className="flex justify-between items-center pt-3"
            style={{ borderTop: `2px dashed ${primaryColor}30` }}
          >
            <span className="font-semibold text-gray-700">
              Subtotal do Sistema:
            </span>
            <span className="text-xl font-bold" style={{ color: primaryColor }}>
              {formatCurrency(sistemaSubtotal)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
/**
 * Renders just the ambiente header (for page-break splitting)
 */
export function PdfAmbienteHeader({
  ambienteName,
  primaryColor,
  className = "",
  standalone = false,
}: {
  ambienteName: string;
  primaryColor: string;
  className?: string;
  standalone?: boolean;
}) {
  return (
    <div
      className={`px-4 pt-3 pb-1.5 bg-white ${className} ${
        standalone ? "border-l-2 border-r-2" : ""
      }`}
      style={{
        borderColor: primaryColor,
      }}
    >
      <div className="flex items-center w-full">
        {/* Left divider */}
        <div
          className="h-px flex-1"
          style={{ backgroundColor: `${primaryColor}20` }}
        />

        {/* HEADER BADGE: SVG Implementation - Centered */}
        {(() => {
          const text = ambienteName.toUpperCase();

          // --- Dynamic Centering Logic ---
          const charWidth = 8; // Average width for 12px bold font (S=8, A=8, L=7)
          const textWidth = Math.ceil(text.length * charWidth);
          const iconSize = 12; // Visual icon width
          const gap = 6;
          const paddingX = 12; // Left/Right padding

          const contentWidth = iconSize + gap + textWidth;
          const totalWidth = contentWidth + paddingX * 2;

          const iconX = paddingX;
          const textX = paddingX + iconSize + gap;

          return (
            <div
              style={{
                margin: "0 12px",
                display: "inline-block",
                verticalAlign: "middle",
              }}
            >
              <svg
                width={totalWidth}
                height="26"
                viewBox={`0 0 ${totalWidth} 26`}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block" }}
              >
                {/* Background Pill */}
                <rect
                  x="0.5"
                  y="0.5"
                  width={totalWidth - 1}
                  height="25"
                  rx="12.5"
                  fill={`${primaryColor}05`}
                  stroke={`${primaryColor}30`}
                />

                {/* Icon Group - Dynamic X */}
                <g transform={`translate(${iconX}, 7)`}>
                  <path
                    d="M6 1C4.065 1 2.5 2.565 2.5 4.5C2.5 7.125 6 11 6 11S9.5 7.125 9.5 4.5C9.5 2.565 7.935 1 6 1ZM6 5.75C5.31 5.75 4.75 5.19 4.75 4.5C4.75 3.81 5.31 3.25 6 3.25C6.69 3.25 7.25 3.81 7.25 4.5C7.25 5.19 6.69 5.75 6 5.75Z"
                    fill="currentColor"
                    transform="scale(1.0)"
                    style={{ color: primaryColor }}
                  />
                </g>

                {/* Text Group - Dynamic X */}
                <text
                  x={textX}
                  y="17.5" // Visual center for 12px font
                  fill={primaryColor}
                  style={{
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    fontSize: "12px",
                    fontWeight: "bold",
                    letterSpacing: "0.05em",
                  }}
                >
                  {text}
                </text>
              </svg>
            </div>
          );
        })()}

        {/* Right divider */}
        <div
          className="h-px flex-1"
          style={{ backgroundColor: `${primaryColor}20` }}
        />
      </div>
    </div>
  );
}
