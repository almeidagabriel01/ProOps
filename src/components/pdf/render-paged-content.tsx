import React, { useLayoutEffect, useRef, useState } from "react";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";
import {
  SAFE_HEIGHT,
  ESTIMATED_HEIGHTS,
  ContentItem,
  calculateSectionHeight,
  calculateProductHeight,
  calculateSistemaBlockHeight,
  calculatePaymentTermsHeight,
  pdfDebugLog,
} from "@/utils/pdf-helpers";
import {
  PdfSistemaBlock,
  PdfSistemaHeader,
  PdfAmbienteHeader,
  PdfSistemaProduct,
  PdfSistemaFooter,
  PdfExtraProductsBlock,
  PdfProductRow,
  PdfTotals,
  PdfSectionRenderer,
  PdfPageHeader,
  PdfPaymentTerms,
} from "./components";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";

// Type definitions
interface Product {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  isExtra?: boolean;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  systemInstanceId?: string;
  _isInactive?: boolean; // Metadata flag for PDF visual hiding
  _isGhost?: boolean;
  _shouldHide?: boolean;
}

interface Sistema {
  sistemaId: string;
  sistemaName: string;
  // Legacy fields (optional for backward compat)
  ambienteId?: string;
  ambienteName?: string;
  description?: string;
  productIds?: string[];
  // New multi-ambiente format
  ambientes?: {
    ambienteId: string;
    ambienteName: string;
    description?: string;
    productIds?: string[];
  }[];
}

interface Proposal {
  sistemas?: Record<string, unknown>[];
  discount?: number;
  extraExpense?: number;
  clientName: string;
  title?: string;
  // Payment options
  downPaymentEnabled?: boolean;
  downPaymentValue?: number;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  downPaymentDueDate?: string;
  firstInstallmentDate?: string;
}

interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface ContentStyles {
  container: Record<string, string | number>;
  headerTitle: Record<string, string | number>;
  sectionText: Record<string, string | number>;
  productTitle: Record<string, string | number>;
  [key: string]: Record<string, string | number>;
}

interface RenderPagedContentProps {
  sections: PdfSection[];
  products: Product[];
  fontFamily: string;
  contentStyles: ContentStyles;
  primaryColor: string;
  renderThemeDecorations: () => React.ReactNode;
  tenant: Tenant | null;
  coverTitle: string;
  proposal: Proposal;
  repeatHeader?: boolean;
  pdfDisplaySettings?: PdfDisplaySettings;
}

/**
 * Builds the list of content items from sections and products
 */
function buildContentItems(
  sections: PdfSection[],
  products: Product[],
  proposal: Proposal,
  primaryColor: string,
  pdfDisplaySettings?: PdfDisplaySettings,
): ContentItem[] {
  const settings = {
    ...defaultPdfDisplaySettings,
    ...pdfDisplaySettings,
    primaryColor,
  };
  const items: ContentItem[] = [];
  let idCounter = 0;
  const generateId = (prefix: string) => `${prefix}-${idCounter++}`;

  const hasSistemas = proposal.sistemas && proposal.sistemas.length > 0;
  let hasAddedPaymentTerms = false;

  // Check if proposal has dynamic payment options configured
  const hasDynamicPaymentOptions = !!(
    (proposal.installmentsEnabled &&
      proposal.installmentsCount &&
      proposal.installmentsCount >= 1) ||
    (proposal.downPaymentEnabled &&
      proposal.downPaymentValue &&
      proposal.downPaymentValue > 0)
  );

  // Helper to identify payment sections based on keywords
  const isPaymentSection = (section: PdfSection): boolean => {
    const content = (section.content || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return (
      content.includes("condies de pagamento") ||
      content.includes("condicoes de pagamento") ||
      content.includes("formas de pagamento") ||
      (hasDynamicPaymentOptions &&
        (content.includes("entrada:") || content.includes("saldo:")))
    );
  };

  // Pre-process sections: Extract payment sections to ensure correct placement
  const manualPaymentSections: PdfSection[] = [];
  const processedSections = sections.filter((section) => {
    if (section.type !== "text" && section.type !== "title") return true;

    if (isPaymentSection(section)) {
      if (hasDynamicPaymentOptions) {
        // Dynamic mode: Skip manual section (replaced by dynamic block)
        return false;
      } else {
        // Manual mode: Extract to render in forced position (after totals)
        manualPaymentSections.push(section);
        return false;
      }
    }
    return true;
  });

  // Helper to add payment terms block (Dynamic or Manual)
  const addUnifiedPaymentBlock = () => {
    if (hasAddedPaymentTerms) return;

    // 1. Add Dynamic Payment Terms if enabled
    if (hasDynamicPaymentOptions) {
      items.push({
        type: "payment-terms",
        id: generateId("payment-terms"),
        height: calculatePaymentTermsHeight(
          !!(
            proposal.downPaymentEnabled &&
            proposal.downPaymentValue &&
            proposal.downPaymentValue > 0
          ),
          proposal.installmentsEnabled ? proposal.installmentsCount || 0 : 0,
        ),
      });
    }

    // 2. Add extracted Manual Payment Sections if Dynamic is NOT enabled
    // (If dynamic is enabled, we skipped them in pre-process, so this is empty)
    if (!hasDynamicPaymentOptions && manualPaymentSections.length > 0) {
      manualPaymentSections.forEach((section) => {
        const height = calculateSectionHeight(section);
        items.push({
          type: "section",
          id: generateId("section-payment"),
          data: section,
          height,
        });
      });
    }

    hasAddedPaymentTerms = true;
  };

  const renderAllSistemas = () => {
    proposal.sistemas!.forEach((rawSistema: Record<string, unknown>) => {
      const sistema = rawSistema as unknown as Sistema;

      // Gather all products for this system across all environments, filtering out hidden ones
      let productsForSistema: Product[] = [];

      // Modern format: products have systemInstanceId
      productsForSistema = products.filter(
        (p) =>
          p.systemInstanceId?.startsWith(`${sistema.sistemaId}-`) &&
          !p._shouldHide &&
          !p._isGhost,
      );

      // Fallback for legacy (no instanceId)
      if (productsForSistema.length === 0) {
        const legacyProductIds = sistema.productIds || [];
        const ambientProductIds =
          sistema.ambientes?.flatMap((a) => a.productIds || []) || [];
        const allIds = [
          ...new Set([...legacyProductIds, ...ambientProductIds]),
        ];

        productsForSistema = products.filter(
          (p) => allIds.includes(p.productId) && !p._shouldHide && !p._isGhost,
        );
      }

      if (productsForSistema.length > 0) {
        addSistemaProducts(sistema, productsForSistema);
      }
    });

    const sistemaProductIds = new Set(
      proposal.sistemas!.flatMap((s: Record<string, unknown>) => {
        const sistema = s as unknown as Sistema;
        if (sistema.ambientes && sistema.ambientes.length > 0) {
          return sistema.ambientes.flatMap((a) => a.productIds || []);
        }
        return (sistema.productIds as string[]) || [];
      }),
    );
    const extraProducts = products.filter(
      (p: Product) =>
        !p.systemInstanceId &&
        !sistemaProductIds.has(p.productId) &&
        !p._shouldHide &&
        !p._isGhost,
    );

    if (extraProducts.length > 0) {
      items.push({
        type: "extra-products-header",
        id: generateId("extra-products-header"),
        height: 60,
      });
      extraProducts.forEach((product, idx) => {
        const h = calculateProductHeight(product, 80, settings);
        items.push({
          type: "product-row",
          id: generateId("product-row"),
          data: { ...product, index: idx },
          height: h,
        });
      });
    }
    items.push({
      type: "totals",
      id: generateId("totals"),
      height: ESTIMATED_HEIGHTS.TOTALS,
    });
    addUnifiedPaymentBlock();
  };

  // Helper to check if section is "Garantia"
  const isGarantiaSection = (section: PdfSection): boolean => {
    const content = (section.content || "").toLowerCase();
    return content.includes("garantia") && section.type === "title";
  };

  const addSistemaProducts = (
    sistema: Sistema,
    productsForSistema: Product[],
  ) => {
    // We need to organize products by environment for granular rendering
    const environments =
      sistema.ambientes && sistema.ambientes.length > 0
        ? sistema.ambientes
        : [
            {
              ambienteId: sistema.ambienteId || "",
              ambienteName: sistema.ambienteName || "",
              description: undefined,
            },
          ];

    // Calculate total height including all environments
    let totalHeight = 100; // Header
    totalHeight += 60; // Footer

    const envsWithProducts = environments
      .map((env) => {
        const currentInstanceId = `${sistema.sistemaId}-${env.ambienteId}`;
        let envProducts = productsForSistema.filter(
          (p) => p.systemInstanceId === currentInstanceId,
        );

        // Legacy fallback
        if (
          envProducts.length === 0 &&
          (!sistema.ambientes || sistema.ambientes.length === 0)
        ) {
          envProducts = productsForSistema;
        }

        const sortedProducts = [...envProducts].sort(
          (a: Product, b: Product) => {
            if (a.isExtra && !b.isExtra) return 1;
            if (!a.isExtra && b.isExtra) return -1;
            return 0;
          },
        );

        // Calculate height for this environment
        let envHeight = 0;
        if (sortedProducts.length > 0) {
          // Ambiente header height (approx 40px)
          envHeight += 40;
          // Products height
          envHeight +=
            calculateSistemaBlockHeight(sortedProducts, settings) - 60 - 100; // Subtract footer/header base from helper
        }

        return {
          env,
          products: sortedProducts,
          height: envHeight,
        };
      })
      .filter((group) => group.products.length > 0);

    totalHeight += envsWithProducts.reduce((sum, grp) => sum + grp.height, 0);

    // Threshold: if block would take more than 40% of page, split it
    const SPLIT_THRESHOLD = SAFE_HEIGHT * 0.4;

    if (totalHeight > SPLIT_THRESHOLD) {
      // Add sistema header
      items.push({
        type: "sistema-header",
        id: generateId("sistema-header"),
        data: { sistema },
        height: 100,
      });

      // Add environments and their products
      envsWithProducts.forEach((group, index) => {
        // Add ambiente header
        items.push({
          type: "ambiente-header",
          id: generateId("ambiente-header"),
          data: {
            ambienteName: group.env.ambienteName,
            ambienteId: group.env.ambienteId,
            description: group.env.description,
            primaryColor: primaryColor,
            isFirst: index === 0,
          },
          height: group.env.description ? 60 : 40,
        });

        // Add products (filter out hidden products)
        const visibleProducts = group.products.filter(
          (p: Product) => !p._shouldHide && !p._isGhost,
        );
        visibleProducts.forEach((product, idx) => {
          const productHeight = calculateProductHeight(product, 80, settings);
          items.push({
            type: "sistema-product",
            id: generateId("sistema-product"),
            data: {
              product,
              sistema, // Parent sistema reference
              isFirst: idx === 0, // Visual separation if needed
              isLast: idx === visibleProducts.length - 1,
              pdfDisplaySettings: settings,
            },
            height: productHeight,
          });
        });
      });

      // Add sistema footer
      const sistemaSubtotal = productsForSistema.reduce(
        (sum: number, p: Product) => sum + p.total,
        0,
      );
      items.push({
        type: "sistema-footer",
        id: generateId("sistema-footer"),
        data: { sistema, sistemaSubtotal, pdfDisplaySettings: settings },
        height: 60,
      });
    } else {
      // Small block - render as single nested unit
      items.push({
        type: "sistema-block",
        id: generateId("sistema-block"),
        data: {
          sistema,
          products: productsForSistema,
          pdfDisplaySettings: settings,
        },
        height: totalHeight,
      });
    } // close else
  };

  const addRegularProducts = (productsToAdd: Product[]) => {
    if (productsToAdd.length > 0) {
      items.push({
        type: "product-header",
        id: generateId("product-header"),
        height: ESTIMATED_HEIGHTS.PRODUCT_HEADER,
      });
      productsToAdd.forEach((product, i) => {
        const h = calculateProductHeight(product, 80, settings);
        items.push({
          type: "product-row",
          id: generateId("product-row"),
          data: { ...product, index: i },
          height: h,
        });
      });
      items.push({
        type: "totals",
        id: generateId("totals"),
        height: ESTIMATED_HEIGHTS.TOTALS,
      });
      addUnifiedPaymentBlock();
    }
  };

  const productSectionIndex = processedSections.findIndex(
    (s) => s.type === "product-table",
  );

  if (productSectionIndex !== -1) {
    processedSections.forEach((section) => {
      if (section.type === "product-table") {
        if (hasSistemas) {
          renderAllSistemas();
        } else {
          addRegularProducts(products);
        }
      } else {
        // Insert payment terms before "Garantia" if not already added
        if (isGarantiaSection(section)) {
          addUnifiedPaymentBlock();
        }

        const height = calculateSectionHeight(section);
        items.push({
          type: "section",
          id: generateId("section"),
          data: section,
          height,
        });
      }
    });
  } else {
    let insertIndex = -1;
    const footerKeywords = [
      "garantia",
      "termos",
      "condies",
      "consideraes",
      "obrigado",
      "agradecemos",
      "validade",
    ];

    for (let i = 0; i < processedSections.length; i++) {
      const text = (processedSections[i].content || "").toLowerCase();
      if (footerKeywords.some((k) => text.includes(k))) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex === -1) {
      insertIndex = processedSections.length > 1 ? 1 : processedSections.length;
    }

    for (let i = 0; i < processedSections.length; i++) {
      if (i === insertIndex) {
        if (hasSistemas) {
          renderAllSistemas();
        } else if (products.length > 0) {
          addRegularProducts(products);
        }
      }

      const section = processedSections[i];

      // Insert payment terms before "Garantia" if not already added
      if (isGarantiaSection(section)) {
        addUnifiedPaymentBlock();
      }

      const height = calculateSectionHeight(section);
      items.push({
        type: "section",
        id: generateId("section"),
        data: section,
        height,
      });
    }

    if (insertIndex >= processedSections.length) {
      if (hasSistemas) {
        renderAllSistemas();
      } else if (products.length > 0) {
        addRegularProducts(products);
      }
    }
  }

  // Final fallback: If payment terms still haven't been added (e.g. no Garantia section), add them at the end
  addUnifiedPaymentBlock();

  return items;
}

/**
 * Distributes content items across pages with optimized space utilization.
 *
 * Algorithm:
 * 1. Try to fit each item on the current page
 * 2. If it doesn't fit, start a new page
 * 3. Special handling for headers: ensure at least one content item follows
 * 4. Allow slight overflow for better space utilization
 */
// Distributes content into pages using either estimated or measured heights
function distributeIntoPages(
  items: ContentItem[],
  measuredHeights: Record<string, number> = {},
): ContentItem[][] {
  const pages: ContentItem[][] = [];
  let currentPage: ContentItem[] = [];
  let currentHeight = ESTIMATED_HEIGHTS.HEADER;

  // Types that are considered "headers" and should have at least one item following
  const headerTypes = new Set([
    "product-header",
    "sistema-header",
    "ambiente-header",
    "extra-products-header",
  ]);

  // Minimum space threshold - only break if we've used at least 20% of the page
  const MIN_PAGE_USAGE = SAFE_HEIGHT * 0.2;

  const hasMeasurements = Object.keys(measuredHeights).length > 0;

  // No overflow allowed - content must stay within SAFE_HEIGHT to prevent cutoff
  // When using measurements, we use 96% of SAFE_HEIGHT to provide a robust buffer for footer/margin
  const MAX_HEIGHT = hasMeasurements ? SAFE_HEIGHT * 0.96 : SAFE_HEIGHT;

  // Buffer to add to measured heights to account for sub-pixel rendering differences
  const MEASUREMENT_BUFFER = 2;

  pdfDebugLog(
    `Page distribution started. Mode=${hasMeasurements ? "MEASURED" : "ESTIMATED"}, SAFE_HEIGHT=${SAFE_HEIGHT}, MAX_HEIGHT=${MAX_HEIGHT.toFixed(0)}`,
  );

  items.forEach((item, index) => {
    const isHeader = headerTypes.has(item.type);
    const nextItem = items[index + 1];

    // Determine height: use measured if available, otherwise fallback to estimate
    // Add buffer to measured heights to be safe
    const itemHeight =
      item.id && measuredHeights[item.id]
        ? measuredHeights[item.id] + MEASUREMENT_BUFFER
        : item.height;

    // Calculate the effective height needed for this item
    // If it's a header, include the next item's height to keep them together
    let effectiveHeight = itemHeight;
    let nextItemHeight = 0;

    if (isHeader && nextItem) {
      nextItemHeight =
        nextItem.id && measuredHeights[nextItem.id]
          ? measuredHeights[nextItem.id] + MEASUREMENT_BUFFER
          : nextItem.height;
      effectiveHeight += nextItemHeight;
    }

    // Would this item fit on the current page?
    const wouldFitNormally = currentHeight + itemHeight <= MAX_HEIGHT;
    const wouldFitWithNext = currentHeight + effectiveHeight <= MAX_HEIGHT;

    // Check if we need to start a new page
    let shouldBreak = false;

    if (isHeader) {
      // For headers: break only if header + next item don't fit AND page has content
      // CRITICAL CHANGE: Only force break if we are near the bottom (e.g. > 75% used)
      // Checks earlier to prevent headers right at the edge
      const isNearBottom = currentHeight > SAFE_HEIGHT * 0.75;

      if (!wouldFitWithNext && isNearBottom) {
        shouldBreak = true;
        pdfDebugLog(
          `Page break before header "${item.type}" - header+next (${effectiveHeight}px) won't fit, current=${currentHeight.toFixed(0)}px`,
        );
      }
    } else if (!wouldFitNormally) {
      // For regular items: break if item doesn't fit AND page has some content
      if (currentHeight > MIN_PAGE_USAGE) {
        shouldBreak = true;
        pdfDebugLog(
          `Page break before "${item.type}" (${itemHeight}px) - current=${currentHeight.toFixed(0)}px, would exceed ${MAX_HEIGHT.toFixed(0)}px`,
        );
      }
    }

    // Execute page break if needed
    if (shouldBreak && currentPage.length > 0) {
      pdfDebugLog(
        `Finishing page ${pages.length + 1} with ${currentPage.length} items, height=${currentHeight.toFixed(0)}px (${((currentHeight / SAFE_HEIGHT) * 100).toFixed(1)}%)`,
      );
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 40; // Header space for continuation pages
    }

    // Add item to current page
    currentPage.push(item);
    currentHeight += itemHeight;

    pdfDebugLog(
      `Added "${item.type}" (${itemHeight}px) -> cumulative=${currentHeight.toFixed(0)}px`,
    );
  });

  // Push the last page if it has content
  if (currentPage.length > 0) {
    pdfDebugLog(
      `Finishing final page ${pages.length + 1} with ${currentPage.length} items, height=${currentHeight.toFixed(0)}px (${((currentHeight / SAFE_HEIGHT) * 100).toFixed(1)}%)`,
    );
    pages.push(currentPage);
  }

  pdfDebugLog(`Distribution complete: ${pages.length} pages created`);
  return pages;
}

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
            Produtos e Servios
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
              products={products.filter((p) => !p._isGhost)}
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
              downPaymentEnabled={proposal.downPaymentEnabled}
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

      case "sistema-product":
        const sistemaProductData = item.data as {
          product: Product;
          sistema: Sistema;
          isFirst: boolean;
          isLast: boolean;
        };
        return (
          <div
            key={`sistema-product-${sistemaProductData.sistema.sistemaId}-${sistemaProductData.product.productId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaProduct
              product={sistemaProductData.product}
              primaryColor={primaryColor}
              isFirst={sistemaProductData.isFirst}
              isLast={sistemaProductData.isLast}
              pdfDisplaySettings={settings}
            />
          </div>
        );

      case "sistema-footer":
        return (
          <div
            key={`sistema-footer-${item.data.sistema.sistemaId}`}
            style={{ width: "100%" }}
          >
            <PdfSistemaFooter
              sistemaSubtotal={item.data.sistemaSubtotal}
              primaryColor={primaryColor}
            />
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
          position: "absolute",
          top: 0,
          left: 0,
          width: "210mm", // Must match page width
          padding: "48px", // Match page padding
          fontFamily, // Match font
          opacity: 0,
          zIndex: -1000,
          pointerEvents: "none",
          visibility: "hidden",
          height: 0, // Prevent adding scroll height
          overflow: "hidden", // Clip content so it doesn't expand scroll
        }}
        aria-hidden="true"
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
