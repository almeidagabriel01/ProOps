import type { PdfSection } from "@/components/features/proposal/pdf-section-editor";
import {
  SAFE_HEIGHT,
  ESTIMATED_HEIGHTS,
  ContentItem,
  calculateSectionHeight,
  calculateProductHeight,
  calculateSistemaBlockHeight,
  calculatePaymentTermsHeight,
  pdfDebugLog,
} from "@/components/pdf/pdf-helpers";
import {
  isProductVisibleInPdf,
  shouldCountInPdfTotals,
} from "./product-visibility";
import { generateProposalPaymentTerms } from "@/lib/proposal-payment";
export type { ContentItem } from "@/components/pdf/pdf-helpers";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";
import type { ProposalProductPricingDetails } from "@/lib/product-pricing";
import type { TenantNiche } from "@/types";

export interface Product {
  productId: string;
  itemType?: "product" | "service";
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  markup?: number;
  pricingDetails?: ProposalProductPricingDetails;
  isExtra?: boolean;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  systemInstanceId?: string;
  _isInactive?: boolean; // Metadata flag for PDF visual hiding
  _isGhost?: boolean;
  _shouldHide?: boolean;
}

export interface Sistema {
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

export interface Proposal {
  sistemas?: Record<string, unknown>[];
  discount?: number;
  extraExpense?: number;
  clientName: string;
  title?: string;
  totalValue?: number;
  closedValue?: number | null;
  // Payment options
  downPaymentEnabled?: boolean;
  downPaymentType?: "value" | "percentage";
  downPaymentPercentage?: number;
  downPaymentValue?: number;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
  downPaymentDueDate?: string;
  firstInstallmentDate?: string;
  downPaymentMethod?: string;
  installmentsPaymentMethod?: string;
  paymentMethod?: string;
}

export interface Tenant {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  niche?: TenantNiche;
}

export interface ContentStyles {
  container: Record<string, string | number>;
  headerTitle: Record<string, string | number>;
  sectionText: Record<string, string | number>;
  productTitle: Record<string, string | number>;
  [key: string]: Record<string, string | number>;
}

export interface RenderPagedContentProps {
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

function buildSimplePaymentTermsText(proposal: Proposal): string {
  return generateProposalPaymentTerms(proposal, { bullet: "-" });
}

function normalizePdfText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isPaymentSectionContent(content?: string): boolean {
  const normalized = normalizePdfText(content || "");
  return (
    normalized.includes("condicoes de pagamento") ||
    normalized.includes("condicao de pagamento") ||
    normalized.includes("formas de pagamento") ||
    normalized.includes("pagamento a vista") ||
    normalized.includes("entrada:") ||
    normalized.includes("parcelamento:") ||
    normalized.includes("saldo:")
  );
}

function isWarrantySectionContent(content?: string): boolean {
  const normalized = normalizePdfText(content || "");
  return normalized.includes("garantia");
}

function reorderPaymentTermsBlock(items: ContentItem[]): ContentItem[] {
  const hasExplicitPaymentTermsSection = items.some(
    (item) => item.type === "section" && item.data?.type === "payment-terms",
  );

  if (hasExplicitPaymentTermsSection) {
    return items;
  }

  const dynamicPaymentItem = items.find(
    (item) => item.type === "payment-terms",
  );

  if (!dynamicPaymentItem) {
    return items;
  }

  const paymentItems = items.filter((item) => {
    if (dynamicPaymentItem) {
      return item.id === dynamicPaymentItem.id;
    }

    if (item.type !== "section") return false;
    const content = (item.data as { content?: string } | undefined)?.content;
    return isPaymentSectionContent(content);
  });

  if (paymentItems.length === 0) {
    return items;
  }

  const baseItems = items.filter((item) => {
    if (item.type === "payment-terms") return false;

    if (dynamicPaymentItem && item.type === "section") {
      const content = (item.data as { content?: string } | undefined)?.content;
      if (isPaymentSectionContent(content)) {
        return false;
      }
    }

    if (item.type !== "section") return true;
    const content = (item.data as { content?: string } | undefined)?.content;
    return !isPaymentSectionContent(content);
  });

  const lastTotalsLikeIndex = (() => {
    for (let i = baseItems.length - 1; i >= 0; i--) {
      const type = baseItems[i].type;
      if (
        type === "totals" ||
        type === "sistema-footer" ||
        type === "ambiente-footer"
      ) {
        return i;
      }
    }
    return -1;
  })();

  const firstWarrantyIndex = baseItems.findIndex((item) => {
    if (item.type !== "section") return false;
    const content = (item.data as { content?: string } | undefined)?.content;
    return isWarrantySectionContent(content);
  });

  let insertionIndex = baseItems.length;
  if (firstWarrantyIndex !== -1) {
    insertionIndex = firstWarrantyIndex;
  }

  if (lastTotalsLikeIndex !== -1) {
    insertionIndex = Math.max(insertionIndex, lastTotalsLikeIndex + 1);
  }

  return [
    ...baseItems.slice(0, insertionIndex),
    ...paymentItems,
    ...baseItems.slice(insertionIndex),
  ];
}

/**
 * Builds the list of content items from sections and products
 */
export function buildContentItems(
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
  const hasExplicitPaymentTermsSection = sections.some(
    (section) => section.type === "payment-terms",
  );
  let hasAddedPaymentTerms = false;
  const shouldRenderProduct = (p: Product): boolean => isProductVisibleInPdf(p);
  const shouldCountProduct = (p: Product): boolean => shouldCountInPdfTotals(p);

  // Check if proposal has dynamic payment options configured
  const hasDynamicPaymentOptions = !!(
    (proposal.installmentsEnabled &&
      proposal.installmentsCount &&
      proposal.installmentsCount >= 1) ||
    (proposal.downPaymentEnabled &&
      (proposal.downPaymentType === "percentage"
        ? ((proposal.totalValue || 0) * (proposal.downPaymentPercentage || 0)) /
          100
        : proposal.downPaymentValue || 0) > 0)
  );

  // Helper to identify payment sections based on keywords
  const isPaymentSection = (section: PdfSection): boolean => {
    const content = (section.content || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "");
    return (
      content.includes("condies de pagamento") ||
      content.includes("condicoes de pagamento") ||
      content.includes("condicao de pagamento") ||
      content.includes("formas de pagamento") ||
      (hasDynamicPaymentOptions &&
        (content.includes("entrada:") ||
          content.includes("parcelamento:") ||
          content.includes("saldo:")))
    );
  };

  // Only skip manual payment sections when dynamic payment block is enabled
  const shouldSkipPaymentSection = (section: PdfSection): boolean => {
    if (!hasDynamicPaymentOptions) return false;
    if (section.type !== "text" && section.type !== "title") return false;
    return isPaymentSection(section);
  };

  // Helper to add dynamic payment terms block (when enabled)
  const addUnifiedPaymentBlock = () => {
    if (hasAddedPaymentTerms) return;
    if (!hasDynamicPaymentOptions) return;

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
          shouldCountProduct(p),
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
          (p) => allIds.includes(p.productId) && shouldCountProduct(p),
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
    const extraProductsTemp = products.filter(
      (p: Product) =>
        !p.systemInstanceId &&
        !sistemaProductIds.has(p.productId) &&
        shouldCountProduct(p),
    );
    const onlyProductsExtra = extraProductsTemp.filter(
      (p) => p.itemType !== "service",
    );
    const onlyServicesExtra = extraProductsTemp.filter(
      (p) => p.itemType === "service",
    );
    const extraProducts = [...onlyProductsExtra, ...onlyServicesExtra];

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
    if (!hasExplicitPaymentTermsSection) {
      addUnifiedPaymentBlock();
    }
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

        // Filter out hidden products for height calculation and rendering
        const visibleSortedProductsTemp = sortedProducts.filter((p) =>
          shouldRenderProduct(p),
        );

        const onlyProducts = visibleSortedProductsTemp.filter(
          (p) => p.itemType !== "service",
        );
        const onlyServices = visibleSortedProductsTemp.filter(
          (p) => p.itemType === "service",
        );
        const visibleSortedProducts = [...onlyProducts, ...onlyServices];

        // Calculate height for this environment
        let envHeight = 0;
        if (visibleSortedProducts.length > 0) {
          // Ambiente header height (approx 40px)
          envHeight += 40;
          // Products height - 2 products per row, so roughly half the total product height
          const rawProductHeight =
            calculateSistemaBlockHeight(visibleSortedProducts, settings) -
            60 -
            100; // Subtract footer/header base from helper
          envHeight += Math.ceil(rawProductHeight / 2);
        }

        return {
          env,
          products: visibleSortedProducts, // Only return visible products for rendering
          allProducts: sortedProducts.filter((p) => shouldCountProduct(p)),
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

        // Add products as pairs (2 per row)
        const visibleProducts = group.products;
        for (let idx = 0; idx < visibleProducts.length; idx += 2) {
          const left = visibleProducts[idx];
          const right = visibleProducts[idx + 1];
          const h1 = calculateProductHeight(left, 80, settings);
          const h2 = right ? calculateProductHeight(right, 80, settings) : 0;
          const rowHeight = Math.max(h1, h2);

          items.push({
            type: "sistema-product-pair",
            id: generateId("sistema-product-pair"),
            data: {
              left,
              right: right || null,
              sistema,
              isFirst: idx === 0,
              isLast: idx + 2 >= visibleProducts.length,
              pdfDisplaySettings: settings,
            },
            height: rowHeight,
          });
        }

        // Add per-environment subtotal if setting is enabled and there are multiple environments
        if (settings.showEnvironmentSubtotals && envsWithProducts.length > 1) {
          const envSubtotal = group.allProducts.reduce(
            (sum: number, p: Product) => sum + p.total,
            0,
          );
          items.push({
            type: "ambiente-footer",
            id: generateId("ambiente-footer"),
            data: {
              ambienteName: group.env.ambienteName,
              ambienteSubtotal: envSubtotal,
              primaryColor,
            },
            height: 36,
          });
        }
      });

      // Add sistema footer
      const sistemaSubtotal = productsForSistema.reduce(
        (sum: number, p: Product) =>
          shouldCountProduct(p) ? sum + p.total : sum,
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
    const visibleProductsTemp = productsToAdd.filter((p) =>
      shouldRenderProduct(p),
    );

    const onlyProducts = visibleProductsTemp.filter(
      (p) => p.itemType !== "service",
    );
    const onlyServices = visibleProductsTemp.filter(
      (p) => p.itemType === "service",
    );
    const visibleProducts = [...onlyProducts, ...onlyServices];

    if (visibleProducts.length > 0) {
      items.push({
        type: "product-header",
        id: generateId("product-header"),
        height: ESTIMATED_HEIGHTS.PRODUCT_HEADER,
      });
      visibleProducts.forEach((product, i) => {
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
      if (!hasExplicitPaymentTermsSection) {
        addUnifiedPaymentBlock();
      }
    }
  };

  const productSectionIndex = sections.findIndex(
    (s) => s.type === "product-table",
  );

  if (productSectionIndex !== -1) {
    sections.forEach((section) => {
      if (section.type === "payment-terms") {
        if (hasDynamicPaymentOptions) {
          addUnifiedPaymentBlock();
        } else {
          const manualPaymentText =
            (section.content || "").trim() || buildSimplePaymentTermsText(proposal);
          const paymentTitleStyles: PdfSection["styles"] = {
            fontSize: "20px",
            fontWeight: "bold",
            color: primaryColor,
            marginTop: "24px",
            marginBottom: "8px",
          };
          items.push({
            type: "section",
            id: generateId("section-payment-title"),
            data: {
              ...section,
              type: "title",
              content: "Condições de Pagamento",
              styles: paymentTitleStyles,
            },
            height: calculateSectionHeight({
              ...section,
              type: "title",
              content: "Condições de Pagamento",
              styles: paymentTitleStyles,
            }),
          });
          items.push({
            type: "section",
            id: generateId("section-payment-text"),
            data: {
              ...section,
              type: "text",
              content: manualPaymentText,
            },
            height: calculateSectionHeight({
              ...section,
              type: "text",
              content: manualPaymentText,
            }),
          });
        }
        return;
      }

      if (section.type === "product-table") {
        if (hasSistemas) {
          renderAllSistemas();
        } else {
          addRegularProducts(products);
        }
      } else {
        // Skip static payment sections only when dynamic payment is enabled
        if (shouldSkipPaymentSection(section)) return;

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

    for (let i = 0; i < sections.length; i++) {
      const text = (sections[i].content || "").toLowerCase();
      if (footerKeywords.some((k) => text.includes(k))) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex === -1) {
      insertIndex = sections.length > 1 ? 1 : sections.length;
    }

    for (let i = 0; i < sections.length; i++) {
      if (i === insertIndex) {
        if (hasSistemas) {
          renderAllSistemas();
        } else if (products.length > 0) {
          addRegularProducts(products);
        }
      }

      const section = sections[i];

      if (section.type === "payment-terms") {
        if (hasDynamicPaymentOptions) {
          addUnifiedPaymentBlock();
        } else {
          const manualPaymentText =
            (section.content || "").trim() || buildSimplePaymentTermsText(proposal);
          const paymentTitleStyles2: PdfSection["styles"] = {
            fontSize: "20px",
            fontWeight: "bold",
            color: primaryColor,
            marginTop: "24px",
            marginBottom: "8px",
          };
          items.push({
            type: "section",
            id: generateId("section-payment-title"),
            data: {
              ...section,
              type: "title",
              content: "Condições de Pagamento",
              styles: paymentTitleStyles2,
            },
            height: calculateSectionHeight({
              ...section,
              type: "title",
              content: "Condições de Pagamento",
              styles: paymentTitleStyles2,
            }),
          });
          items.push({
            type: "section",
            id: generateId("section-payment-text"),
            data: {
              ...section,
              type: "text",
              content: manualPaymentText,
            },
            height: calculateSectionHeight({
              ...section,
              type: "text",
              content: manualPaymentText,
            }),
          });
        }
        continue;
      }

      // Skip static payment sections only when dynamic payment is enabled
      if (shouldSkipPaymentSection(section)) {
        continue;
      }

      const height = calculateSectionHeight(section);
      items.push({
        type: "section",
        id: generateId("section"),
        data: section,
        height,
      });
    }

    if (insertIndex >= sections.length) {
      if (hasSistemas) {
        renderAllSistemas();
      } else if (products.length > 0) {
        addRegularProducts(products);
      }
    }
  }

  // Final fallback: If payment terms still haven't been added (e.g. no Garantia section), add them at the end
  if (!hasExplicitPaymentTermsSection) {
    addUnifiedPaymentBlock();
  }

  return hasExplicitPaymentTermsSection
    ? items
    : reorderPaymentTermsBlock(items);
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
export function distributeIntoPages(
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


