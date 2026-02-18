import { formatCurrency } from "@/utils/format-utils";
import { PdfDisplaySettings } from "@/types/pdf-display-settings";
import { PdfExtraBadge } from "./pdf-extra-badge";
import { PdfProduct } from "./pdf-sistema-types";

export function PdfProductTitle({
  productName,
  isExtra,
}: {
  productName: string;
  isExtra?: boolean;
}) {
  return (
    <table
      style={{
        display: "inline-table",
        borderCollapse: "collapse",
        tableLayout: "auto",
        maxWidth: "100%",
        verticalAlign: "top",
      }}
    >
      <tbody>
        <tr>
          <td style={{ padding: 0, verticalAlign: "top" }}>
            <span
              data-pdf-item-title-text="1"
              style={{
                display: "inline-block",
                fontWeight: 600,
                color: "#111827",
                fontSize: "14px",
                lineHeight: "20px",
                whiteSpace: "normal",
                overflowWrap: "break-word",
                wordBreak: "break-word",
              }}
            >
              {productName}
            </span>
          </td>
          {isExtra && (
            <td
              data-pdf-padding-top="2px"
              style={{
                padding: 0,
                paddingLeft: "8px",
                paddingTop: "2px",
                verticalAlign: "top",
                whiteSpace: "nowrap",
              }}
            >
              <PdfExtraBadge />
            </td>
          )}
        </tr>
      </tbody>
    </table>
  );
}

export function PdfAmbienteTag({
  ambienteName,
  primaryColor,
  scale = 1,
}: {
  ambienteName: string;
  primaryColor: string;
  scale?: number;
}) {
  const text = ambienteName.toUpperCase();
  const height = Math.round(20 * scale);
  const paddingX = Math.round(10 * scale);
  const gap = Math.round(4 * scale);
  const fontSize = Math.round(10 * scale);
  const iconSize = Math.round(10 * scale);
  const radius = Math.round(height / 2);
  const rightSafetyGap = Math.max(6, Math.round(4 * scale));
  const textWidth = Math.max(fontSize, Math.ceil(text.length * fontSize * 0.72));
  const width = paddingX * 2 + iconSize + gap + textWidth + rightSafetyGap;
  const iconX = paddingX;
  const iconY = Number(((height - iconSize) / 2).toFixed(2));
  const textX = iconX + iconSize + gap;
  const textY = Number((height / 2 + fontSize * 0.36).toFixed(2));
  const iconScale = iconSize / 12;

  return (
    <span
      data-pdf-ambiente-pill="1"
      style={{
        display: "inline-block",
        width: `${width}px`,
        height: `${height}px`,
        lineHeight: "0",
        verticalAlign: "top",
        boxSizing: "border-box",
        margin: "0",
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        style={{
          display: "block",
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <rect
          x="0.5"
          y="0.5"
          width={width - 1}
          height={height - 1}
          rx={radius}
          ry={radius}
          fill="#ffffff"
          stroke={`${primaryColor}59`}
        />
        <g transform={`translate(${iconX}, ${iconY}) scale(${iconScale})`}>
          <path
            d="M6 1C4.065 1 2.5 2.565 2.5 4.5C2.5 7.125 6 11 6 11S9.5 7.125 9.5 4.5C9.5 2.565 7.935 1 6 1ZM6 5.75C5.31 5.75 4.75 5.19 4.75 4.5C4.75 3.81 5.31 3.25 6 3.25C6.69 3.25 7.25 3.81 7.25 4.5C7.25 5.19 6.69 5.75 6 5.75Z"
            fill={primaryColor}
          />
        </g>
        <text
          x={textX}
          y={textY}
          textAnchor="start"
          fontSize={fontSize}
          fontWeight="700"
          fill={primaryColor}
          fontFamily="Arial, sans-serif"
        >
          {text}
        </text>
      </svg>
    </span>
  );
}

export function PdfSistemaProductCard({
  product,
  primaryColor,
  settings,
  evenBackground = false,
}: {
  product: PdfProduct;
  primaryColor: string;
  settings: PdfDisplaySettings;
  evenBackground?: boolean;
}) {
  const allImages = product.productImages?.length
    ? product.productImages
    : product.productImage
      ? [product.productImage]
      : [];

  return (
    <div
      className="px-3 pb-3 pt-2 rounded-lg border break-inside-avoid"
      style={{
        backgroundColor: product.isExtra
          ? "#eff6ff"
          : evenBackground
            ? "#f9fafb"
            : "#ffffff",
        borderColor: product.isExtra ? "#bfdbfe" : "#e5e7eb",
      }}
    >
      <div className="space-y-2">
        <table
          data-pdf-item-row="1"
          data-pdf-item-id={product.productId}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <tbody>
            <tr>
              <td
                data-pdf-item-title="1"
                style={{
                  verticalAlign: "top",
                  width: "100%",
                  minWidth: 0,
                }}
              >
                <PdfProductTitle
                  productName={product.productName}
                  isExtra={product.isExtra}
                />
              </td>
              <td
                className="text-right shrink-0"
                data-pdf-item-qty="1"
                style={{
                  verticalAlign: "top",
                  paddingLeft: "12px",
                  whiteSpace: "nowrap",
                  textAlign: "right",
                  minWidth: "68px",
                  width: "68px",
                  lineHeight: "1",
                  marginTop: "0",
                  paddingTop: "0",
                }}
              >
                {settings.showProductPrices ? (
                  <div
                    className="space-y-0"
                    style={{
                      display: "inline-flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      lineHeight: "1.2",
                    }}
                  >
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
                  <span
                    className="font-medium text-xs text-gray-600"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      gap: "4px",
                      minHeight: "20px",
                      lineHeight: "1",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span>Qtd:</span>
                    <span>{product.quantity}</span>
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

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

        {settings.showProductDescriptions && product.productDescription && (
          <p className="text-[10px] text-gray-600 leading-relaxed pt-1">
            {product.productDescription}
          </p>
        )}
      </div>
    </div>
  );
}
