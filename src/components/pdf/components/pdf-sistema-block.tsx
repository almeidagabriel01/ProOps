import { formatCurrency } from "@/utils/format-utils";
import { PdfDisplaySettings } from "@/types/pdf-display-settings";
import {
  PdfAmbienteTag,
  PdfSistemaProductCard,
} from "./pdf-sistema-primitives";
import {
  PdfSistema,
  PdfProduct,
  PdfSistemaBlockProps,
  resolvePdfDisplaySettings,
  resolveSistemaAmbientes,
} from "./pdf-sistema-types";

function PdfSistemaHead({
  sistema,
  primaryColor,
  titleClassName,
  titleLineHeight,
  tagScale,
  iconSizeClass,
  iconClass,
  iconColumnWidth,
  iconPaddingRight,
}: {
  sistema: PdfSistema;
  primaryColor: string;
  titleClassName: string;
  titleLineHeight: string;
  tagScale: number;
  iconSizeClass: string;
  iconClass: string;
  iconColumnWidth: string;
  iconPaddingRight: string;
}) {
  const ambientes = resolveSistemaAmbientes(sistema);

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        margin: 0,
        padding: 0,
      }}
    >
      <tbody>
        <tr>
          <td
            valign="top"
            style={{
              width: iconColumnWidth,
              verticalAlign: "top",
              padding: 0,
              paddingRight: iconPaddingRight,
              margin: 0,
            }}
          >
            <div
              data-pdf-system-icon="1"
              className={`${iconSizeClass} rounded-lg flex items-center justify-center shadow-md shrink-0`}
              style={{ backgroundColor: primaryColor }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={iconClass}
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
          </td>
          <td
            valign="top"
            style={{
              verticalAlign: "top",
              padding: 0,
              margin: 0,
            }}
          >
            <table
              data-pdf-system-head="1"
              style={{
                borderCollapse: "collapse",
                width: "auto",
              }}
            >
              <tbody>
                <tr>
                  <td style={{ padding: 0 }}>
                    <h2
                      data-pdf-system-title="1"
                      className={titleClassName}
                      style={{
                        color: primaryColor,
                        margin: 0,
                        lineHeight: titleLineHeight,
                      }}
                    >
                      {sistema.sistemaName}
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td
                    data-pdf-padding-top="10px"
                    style={{ padding: 0, paddingTop: "10px" }}
                  >
                    <div
                      data-pdf-ambiente-list="1"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      {ambientes.map((amb, i) => (
                        <PdfAmbienteTag
                          key={`${amb.ambienteId}-${i}`}
                          ambienteName={amb.ambienteName}
                          primaryColor={primaryColor}
                          scale={tagScale}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {sistema.description && (
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                {sistema.description}
              </p>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function PdfSistemaBlock({
  sistema,
  products,
  primaryColor,
  pdfDisplaySettings,
}: PdfSistemaBlockProps) {
  const settings = resolvePdfDisplaySettings(pdfDisplaySettings);
  const ambientes = resolveSistemaAmbientes(sistema);
  const sistemaSubtotal = products.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="mt-16 mb-6 break-inside-avoid">
      <div
        className="rounded-xl border-2 overflow-hidden"
        style={{ borderColor: primaryColor }}
      >
        <div
          className="p-4"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)`,
            borderBottom: `2px solid ${primaryColor}30`,
          }}
        >
          <PdfSistemaHead
            sistema={sistema}
            primaryColor={primaryColor}
            titleClassName="text-xl font-bold"
            titleLineHeight="24px"
            tagScale={0.8}
            iconSizeClass="w-12 h-12"
            iconClass="w-6 h-6 text-white"
            iconColumnWidth="48px"
            iconPaddingRight="12px"
          />
        </div>

        <div className="bg-white">
          {ambientes.map((amb, index) => {
            const currentInstanceId = `${sistema.sistemaId}-${amb.ambienteId}`;
            let scopeProducts = products.filter(
              (p) => p.systemInstanceId === currentInstanceId,
            );

            if (scopeProducts.length === 0 && (!sistema.ambientes || sistema.ambientes.length === 0)) {
              scopeProducts = products;
            }

            const activeProducts = scopeProducts.filter((product) => !product._isInactive);
            if (activeProducts.length === 0) return null;

            return (
              <div key={currentInstanceId}>
                <PdfAmbienteHeader
                  ambienteName={amb.ambienteName || "Ambiente"}
                  primaryColor={primaryColor}
                  className={index > 0 ? "border-t border-dashed" : ""}
                  description={amb.description}
                />

                <div className="px-4 pb-3 space-y-2">
                  {activeProducts.map((product, idx) => (
                    <PdfSistemaProductCard
                      key={`${product.productId}-${idx}`}
                      product={product}
                      primaryColor={primaryColor}
                      settings={settings}
                      evenBackground={idx % 2 === 0}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {settings.showSubtotals && (
            <div
              className="flex justify-between items-center px-4 pb-3 pt-2"
              style={{ borderTop: `2px dashed ${primaryColor}30` }}
            >
              <span className="font-semibold text-gray-700 text-sm">
                Subtotal do Sistema:
              </span>
              <span className="text-lg font-bold" style={{ color: primaryColor }}>
                {formatCurrency(sistemaSubtotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PdfSistemaHeader({
  sistema,
  primaryColor,
}: {
  sistema: PdfSistema;
  primaryColor: string;
}) {
  return (
    <div className="">
      <div
        className="rounded-t-xl border-2 border-b-0 overflow-hidden"
        style={{ borderColor: primaryColor }}
      >
        <div
          className="p-5"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}10 100%)`,
            borderBottom: `2px solid ${primaryColor}30`,
          }}
        >
          <PdfSistemaHead
            sistema={sistema}
            primaryColor={primaryColor}
            titleClassName="text-2xl font-bold"
            titleLineHeight="28px"
            tagScale={1}
            iconSizeClass="w-14 h-14"
            iconClass="w-7 h-7 text-white"
            iconColumnWidth="56px"
            iconPaddingRight="16px"
          />
        </div>
      </div>
    </div>
  );
}

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
  const settings = resolvePdfDisplaySettings(pdfDisplaySettings);

  return (
    <div
      className={`border-l-2 border-r-2 bg-white ${isFirst ? "pt-3" : ""}`}
      style={{ borderColor: primaryColor }}
    >
      <div className="px-4 pb-2">
        <PdfSistemaProductCard
          product={product}
          primaryColor={primaryColor}
          settings={settings}
          evenBackground
        />
      </div>
    </div>
  );
}

export function PdfSistemaFooter({
  sistemaSubtotal,
  primaryColor,
  pdfDisplaySettings,
}: {
  sistemaSubtotal: number;
  primaryColor: string;
  pdfDisplaySettings?: PdfDisplaySettings;
}) {
  const settings = resolvePdfDisplaySettings(pdfDisplaySettings);
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

export function PdfAmbienteHeader({
  ambienteName,
  primaryColor,
  className = "",
  standalone = false,
  description,
}: {
  ambienteName: string;
  primaryColor: string;
  className?: string;
  standalone?: boolean;
  description?: string;
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
        <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}20` }} />
        <PdfAmbienteTag
          ambienteName={ambienteName}
          primaryColor={primaryColor}
          scale={1.2}
        />
        <div className="h-px flex-1" style={{ backgroundColor: `${primaryColor}20` }} />
      </div>

      {description && (
        <p className="text-xs text-gray-500 mt-1 text-center italic">
          {description}
        </p>
      )}
    </div>
  );
}
