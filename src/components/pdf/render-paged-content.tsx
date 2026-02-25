import React, { useLayoutEffect, useRef, useState } from "react";
import { pdfDebugLog } from "@/utils/pdf-helpers";
import { formatCurrency } from "@/utils/format-utils";
import {
  ContentItem,
  Product,
  RenderPagedContentProps,
  Sistema,
  buildContentItems,
  distributeIntoPages,
} from "./render-paged-content.helpers";
import {
  PdfSistemaBlock,
  PdfSistemaHeader,
  PdfAmbienteHeader,
  PdfSistemaFooter,
  PdfExtraProductsBlock,
  PdfProductRow,
  PdfTotals,
  PdfSectionRenderer,
  PdfPageHeader,
  PdfPaymentTerms,
  PdfSistemaProductCard,
} from "./components";
import { defaultPdfDisplaySettings } from "@/types/pdf-display-settings";

// Type definitions
export const RenderPagedContent: React.FC<RenderPagedContentProps> = ({
  sections,
  products,
  fontFamily,
  contentStyles,
  primaryColor,
  renderThemeDecorations,
  tenant,
  coverTitle,
  proposal,
  repeatHeader,
  pdfDisplaySettings = defaultPdfDisplaySettings,
}) => {
  // Merge with defaults to ensure all settings have values
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };

  const [measuredHeights, setMeasuredHeights] = useState<
    Record<string, number>
  >({});
  const measureRef = useRef<HTMLDivElement>(null);

  const items = buildContentItems(
    sections,
    products,
    proposal,
    primaryColor,
    settings,
  );

  // Measurement effect: capture real DOM heights
  useLayoutEffect(() => {
    if (!measureRef.current) return;

    const newHeights: Record<string, number> = {};
    let hasChanges = false;
    let count = 0;

    items.forEach((item) => {
      if (item.id) {
        const el = measureRef.current?.querySelector(
          `[data-measure-id="${item.id}"]`,
        ) as HTMLElement;
        if (el) {
          const rect = el.getBoundingClientRect();
          // Calculate scale factor by comparing rendered width vs layout width
          // This handles the case where the parent container is scaled (e.g. in Edit PDF zoom)
          // Default to 1 if offsetWidth is 0 to avoid division by zero
          const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1;

          // Use unscaled height for pagination logic
          const height = rect.height / scale;
          const currentHeight = measuredHeights[item.id] || 0;

          // Only update if difference > 0.5px to avoid infinite loops from micro-adjustments
          if (Math.abs(height - currentHeight) > 0.5) {
            newHeights[item.id] = height;
            hasChanges = true;
          } else {
            newHeights[item.id] = currentHeight;
          }
          count++;
        }
      }
    });

    if (hasChanges) {
      pdfDebugLog(`Measurement updated for ${count} items`);
      setMeasuredHeights(newHeights);
    }
  }, [items, measuredHeights]); // Re-run when items change or measurements update (to converge)

  const pages = distributeIntoPages(items, measuredHeights);

  const renderItem = (item: ContentItem) => {
    switch (item.type) {
      case "section":
        return (
          <PdfSectionRenderer
            key={item.data.id}
            section={item.data}
            primaryColor={primaryColor}
            contentStyles={
              contentStyles as unknown as Record<string, React.CSSProperties>
            }
          />
        );

      case "sistema-block":
        return (
          <div
            key={`sistema-${item.data.sistema.sistemaId}-${item.data.sistema.ambienteId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaBlock
              sistema={item.data.sistema}
              products={item.data.products}
              primaryColor={primaryColor}
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "extra-products-block":
        return (
          <div key="extra-products" style={{ width: "100%" }}>
            <PdfExtraProductsBlock
              products={item.data.products}
              primaryColor={primaryColor}
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "product-header":
        return (
          <h2
            key="product-header"
            className="text-xl font-bold mb-4 pb-2 border-b-2 mt-4"
            style={{ ...contentStyles.productTitle, width: "100%" }}
          >
            Itens (Produtos e Serviços)
          </h2>
        );

      case "product-row":
        return (
          <div
            key={`product-${item.data.productId}-${item.data.index}`}
            style={{ width: "100%" }}
          >
            <PdfProductRow
              product={item.data}
              index={item.data.index}
              contentStyles={
                contentStyles as unknown as Record<string, React.CSSProperties>
              }
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "totals":
        return (
          <div key="totals" style={{ width: "100%" }}>
            <PdfTotals
              products={products.filter(
                (p) => Number(p.quantity || 0) > 0 && !p._isGhost,
              )}
              discount={proposal.discount || 0}
              extraExpense={proposal.extraExpense || 0}
              contentStyles={
                contentStyles as unknown as Record<string, React.CSSProperties>
              }
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "extra-products-header":
        return null;

      case "payment-terms":
        return (
          <div key="payment-terms" style={{ width: "100%" }}>
            <PdfPaymentTerms
              contentStyles={
                contentStyles as unknown as Record<string, React.CSSProperties>
              }
              proposalTotalValue={proposal.totalValue}
              downPaymentEnabled={proposal.downPaymentEnabled}
              downPaymentType={proposal.downPaymentType}
              downPaymentPercentage={proposal.downPaymentPercentage}
              downPaymentValue={proposal.downPaymentValue}
              installmentsEnabled={proposal.installmentsEnabled}
              installmentsCount={proposal.installmentsCount}
              installmentValue={proposal.installmentValue}
              downPaymentDueDate={proposal.downPaymentDueDate}
              firstInstallmentDate={proposal.firstInstallmentDate}
            />
          </div>
        );

      case "sistema-header":
        return (
          <div
            key={`sistema-header-${item.data.sistema.sistemaId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaHeader
              sistema={item.data.sistema}
              primaryColor={primaryColor}
            />
          </div>
        );

      case "ambiente-header":
        return (
          <div
            key={`ambiente-header-${item.data.ambienteId}`}
            style={{ width: "100%" }}
          >
            <PdfAmbienteHeader
              ambienteName={item.data.ambienteName}
              primaryColor={primaryColor}
              standalone={true}
              description={item.data.description}
            />
          </div>
        );

      case "sistema-product-pair": {
        const pairData = item.data as {
          left: Product;
          right: Product | null;
          sistema: Sistema;
          isFirst: boolean;
          isLast: boolean;
          pdfDisplaySettings?: typeof settings;
        };
        const pairSettings = {
          ...defaultPdfDisplaySettings,
          ...pairData.pdfDisplaySettings,
        };
        return (
          <div
            key={`sistema-pair-${pairData.sistema.sistemaId}-${pairData.left.productId}`}
            style={{ width: "100%" }}
          >
            <div
              className="border-l-2 border-r-2 bg-white"
              style={{
                borderColor: primaryColor,
                padding: pairData.isFirst ? "8px 8px 4px 8px" : "4px 8px",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: "4px 0",
                  tableLayout: "fixed",
                }}
              >
                <tbody>
                  <tr>
                    {pairData.right ? (
                      <>
                        <td
                          style={{
                            verticalAlign: "top",
                            width: "50%",
                            padding: 0,
                          }}
                        >
                          <PdfSistemaProductCard
                            product={pairData.left}
                            primaryColor={primaryColor}
                            settings={pairSettings}
                            evenBackground
                          />
                        </td>
                        <td
                          style={{
                            verticalAlign: "top",
                            width: "50%",
                            padding: 0,
                          }}
                        >
                          <PdfSistemaProductCard
                            product={pairData.right}
                            primaryColor={primaryColor}
                            settings={pairSettings}
                            evenBackground={false}
                          />
                        </td>
                      </>
                    ) : (
                      <td
                        colSpan={2}
                        style={{ verticalAlign: "top", padding: 0 }}
                      >
                        <PdfSistemaProductCard
                          product={pairData.left}
                          primaryColor={primaryColor}
                          settings={pairSettings}
                          evenBackground
                        />
                      </td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      case "sistema-footer":
        return (
          <div
            key={`sistema-footer-${item.data.sistema.sistemaId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaFooter
              sistemaSubtotal={item.data.sistemaSubtotal}
              primaryColor={primaryColor}
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "ambiente-footer":
        return (
          <div
            key={`ambiente-footer-${item.data.ambienteName}`}
            style={{ width: "100%" }}
          >
            <div
              className="border-l-2 border-r-2 bg-white"
              style={{ borderColor: primaryColor }}
            >
              <div
                className="flex justify-between items-center px-4 pb-2 pt-1.5"
                style={{ borderTop: `1px dashed ${primaryColor}30` }}
              >
                <span className="text-xs font-medium text-gray-500">
                  Subtotal ({item.data.ambienteName}):
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: primaryColor }}
                >
                  {formatCurrency(item.data.ambienteSubtotal)}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Hidden Measurement Container - Renders all items to measure measuring their real DOM height */}
      <div
        ref={measureRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "210mm", // Must match page width
          padding: "48px", // Match page padding
          fontFamily, // Match font
          transform: "translate(-2400px, -2400px)",
          zIndex: -1000,
          pointerEvents: "none",
        }}
        aria-hidden="true"
        data-html2canvas-ignore="true"
      >
        {items.map((item, idx) => (
          <div
            key={item.id || `measure-${idx}`}
            data-measure-id={item.id}
            style={{ width: "100%", display: "flow-root" }}
          >
            {renderItem(item)}
          </div>
        ))}
      </div>

      {pages.map((pageItems, pageIndex) => (
        <div
          key={pageIndex}
          className="mx-auto bg-white shadow-sm mb-8 pdf-page-container"
          style={{
            fontFamily,
            width: "210mm",
            height: "297mm",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
          data-page-index={pageIndex + 1}
        >
          {/* Theme Decorations - Fixed to page */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            {renderThemeDecorations()}
          </div>

          {/* Content Area */}
          <div
            style={{
              position: "relative",
              zIndex: 10,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              padding: "48px",
              minHeight: 0,
            }}
          >
            {/* Header */}
            {(pageIndex === 0 || repeatHeader) && (
              <PdfPageHeader
                tenantName={tenant?.name || ""}
                coverTitle={coverTitle}
                clientName={proposal.clientName}
                contentStyles={
                  contentStyles as unknown as Record<
                    string,
                    React.CSSProperties
                  >
                }
              />
            )}

            {/* Main Content - Grows to fill space */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexWrap: "wrap",
                alignContent: "flex-start",
              }}
            >
              {pageItems.map((item, idx) => (
                <React.Fragment key={idx}>{renderItem(item)}</React.Fragment>
              ))}
            </div>

            {/* Footer - Always at bottom */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                paddingTop: "16px",
                fontSize: "12px",
                color: "#6b7280",
                flexShrink: 0,
              }}
            >
              {pageIndex + 2}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
