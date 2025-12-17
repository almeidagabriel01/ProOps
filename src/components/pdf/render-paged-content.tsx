import React from "react";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";
import { formatCurrency } from "@/utils/format-utils";
import {
  SAFE_HEIGHT,
  ESTIMATED_HEIGHTS,
  ContentItem,
  calculateSectionHeight,
  calculateProductHeight,
  calculateSistemaBlockHeight
} from "@/utils/pdf-helpers";
import {
  PdfSistemaBlock,
  PdfExtraProductsBlock,
  PdfProductRow,
  PdfTotals,
  PdfSectionRenderer,
  PdfPageHeader,
} from "./components";

interface RenderPagedContentProps {
  sections: PdfSection[];
  products: any[];
  fontFamily: string;
  contentStyles: any;
  primaryColor: string;
  renderThemeDecorations: () => React.ReactNode;
  tenant: any;
  coverTitle: string;
  proposal: any;
  repeatHeader?: boolean;
}

/**
 * Builds the list of content items from sections and products
 */
function buildContentItems(
  sections: PdfSection[],
  products: any[],
  proposal: any
): ContentItem[] {
  const items: ContentItem[] = [];
  const hasSistemas = proposal.sistemas && proposal.sistemas.length > 0;

  // Helper to add products for a sistema as a single block
  const addSistemaProducts = (sistema: any, productsForSistema: any[]) => {
    const sortedProducts = [...productsForSistema].sort((a: any, b: any) => {
      if (a.isExtra && !b.isExtra) return 1;
      if (!a.isExtra && b.isExtra) return -1;
      return 0;
    });

    const totalHeight = calculateSistemaBlockHeight(sortedProducts);

    items.push({
      type: "sistema-block",
      data: { sistema, products: sortedProducts },
      height: totalHeight,
    });
  };

  // Helper to add regular products
  const addRegularProducts = (productsToAdd: any[]) => {
    if (productsToAdd.length > 0) {
      items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
      productsToAdd.forEach((product, i) => {
        const h = calculateProductHeight(product);
        items.push({
          type: "product-row",
          data: { ...product, index: i },
          height: h,
        });
      });
      items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
    }
  };

  // Check for explicit product-table section
  const productSectionIndex = sections.findIndex(s => s.type === 'product-table');

  if (productSectionIndex !== -1) {
    // EXPLICIT MODE
    sections.forEach(section => {
      if (section.type === 'product-table') {
        if (hasSistemas) {
          // AUTOMATION MODE
          proposal.sistemas.forEach((sistema: any) => {
            const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
            let productsForSistema = products.filter((p: any) => p.systemInstanceId === systemInstanceId);

            const isLegacy = !products.some((p: any) => p.systemInstanceId);
            if (productsForSistema.length === 0 && isLegacy) {
              productsForSistema = products.filter((p: any) => sistema.productIds?.includes(p.productId));
            }

            if (productsForSistema.length > 0) {
              addSistemaProducts(sistema, productsForSistema);
            }
          });

          // Extra products
          const sistemaProductIds = new Set(
            proposal.sistemas.flatMap((s: any) => s.productIds || [])
          );
          const extraProducts = products.filter((p: any) => !p.systemInstanceId && !sistemaProductIds.has(p.productId));

          if (extraProducts.length > 0) {
            let blockHeight = 140;
            extraProducts.forEach((product) => {
              let h = 80;
              if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                h += 100;
              }
              blockHeight += h;
            });
            blockHeight += 60;

            items.push({
              type: "extra-products-block",
              data: { products: extraProducts },
              height: blockHeight,
            });
          }
          items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
        } else {
          addRegularProducts(products);
        }
      } else {
        const height = calculateSectionHeight(section);
        items.push({ type: "section", data: section, height });
      }
    });
  } else {
    // SMART FALLBACK MODE
    let insertIndex = -1;
    const footerKeywords = ["garantia", "termos", "condições", "considerações", "obrigado", "agradecemos", "validade"];

    for (let i = 0; i < sections.length; i++) {
      const text = (sections[i].content || "").toLowerCase();
      if (footerKeywords.some(k => text.includes(k))) {
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
          proposal.sistemas.forEach((sistema: any) => {
            const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
            let productsForSistema = products.filter((p: any) => p.systemInstanceId === systemInstanceId);

            const isLegacy = !products.some((p: any) => p.systemInstanceId);
            if (productsForSistema.length === 0 && isLegacy) {
              productsForSistema = products.filter((p: any) => sistema.productIds?.includes(p.productId));
            }

            if (productsForSistema.length > 0) {
              addSistemaProducts(sistema, productsForSistema);
            }
          });

          const sistemaProductIds = new Set(
            proposal.sistemas.flatMap((s: any) => s.productIds || [])
          );
          const extraProducts = products.filter((p: any) => !p.systemInstanceId && !sistemaProductIds.has(p.productId));

          if (extraProducts.length > 0) {
            items.push({ type: "extra-products-header", height: 60 });
            extraProducts.forEach((product, idx) => {
              const h = calculateProductHeight(product);
              items.push({ type: "product-row", data: { ...product, index: idx }, height: h });
            });
          }
          items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
        } else if (products.length > 0) {
          addRegularProducts(products);
        }
      }

      const section = sections[i];
      const height = calculateSectionHeight(section);
      items.push({ type: "section", data: section, height });
    }

    if (insertIndex >= sections.length) {
      if (hasSistemas) {
        proposal.sistemas.forEach((sistema: any) => {
          const productsForSistema = products.filter((p: any) =>
            sistema.productIds?.includes(p.productId)
          );
          if (productsForSistema.length > 0) {
            addSistemaProducts(sistema, productsForSistema);
          }
        });
        items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
      } else if (products.length > 0) {
        addRegularProducts(products);
      }
    }
  }

  return items;
}

/**
 * Distributes content items across pages respecting height limits
 */
function distributeIntoPages(items: ContentItem[]): ContentItem[][] {
  const pages: ContentItem[][] = [];
  let currentPage: ContentItem[] = [];
  let currentHeight = ESTIMATED_HEIGHTS.HEADER;

  items.forEach((item, index) => {
    let forceBreak = false;

    // Orphan Control
    if (item.type === "product-header" || (item.type === "section" && item.data?.type === "title")) {
      const nextItem = items[index + 1];
      if (nextItem && currentHeight + item.height + nextItem.height > SAFE_HEIGHT) {
        forceBreak = true;
      }
    }

    // Keep blocks together
    if (item.type === "sistema-block" || item.type === "extra-products-block") {
      if (currentHeight + item.height > SAFE_HEIGHT && currentHeight > ESTIMATED_HEIGHTS.HEADER) {
        forceBreak = true;
      }
    }

    if (forceBreak || currentHeight + item.height > SAFE_HEIGHT) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 60;
    }

    currentPage.push(item);
    currentHeight += item.height;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

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
}) => {
  // Build and paginate content
  const items = buildContentItems(sections, products, proposal);
  const pages = distributeIntoPages(items);

  // Render a single item
  const renderItem = (item: ContentItem) => {
    switch (item.type) {
      case "section":
        return (
          <PdfSectionRenderer
            key={item.data.id}
            section={item.data}
            primaryColor={primaryColor}
            contentStyles={contentStyles}
          />
        );

      case "sistema-block":
        return (
          <PdfSistemaBlock
            key={`sistema-${item.data.sistema.sistemaId}-${item.data.sistema.ambienteId}`}
            sistema={item.data.sistema}
            products={item.data.products}
            primaryColor={primaryColor}
          />
        );

      case "extra-products-block":
        return (
          <PdfExtraProductsBlock
            key="extra-products"
            products={item.data.products}
            primaryColor={primaryColor}
          />
        );

      case "product-header":
        return (
          <h2
            key="product-header"
            className="text-xl font-bold mb-4 pb-2 border-b-2 mt-4"
            style={contentStyles.productTitle}
          >
            Produtos e Serviços
          </h2>
        );

      case "product-row":
        return (
          <PdfProductRow
            key={`product-${item.data.productId}-${item.data.index}`}
            product={item.data}
            index={item.data.index}
            contentStyles={contentStyles}
          />
        );

      case "totals":
        return (
          <PdfTotals
            key="totals"
            products={products}
            discount={proposal.discount || 0}
            contentStyles={contentStyles}
          />
        );

      case "extra-products-header":
        return null;

      default:
        return null;
    }
  };

  return (
    <>
      {pages.map((pageItems, pageIndex) => (
        <div
          key={pageIndex}
          className="pdf-page-container h-[297mm] w-[210mm] mx-auto relative bg-white shadow-sm mb-8 overflow-hidden"
          style={{ fontFamily, ...contentStyles.container }}
          data-page-index={pageIndex + 1}
        >
          {/* Theme Decorations */}
          <div className="absolute inset-0 pointer-events-none">
            {renderThemeDecorations()}
          </div>

          {/* Page Content */}
          <div className="p-12 relative z-10 h-full flex flex-col">
            {/* Header */}
            {(pageIndex === 0 || repeatHeader) && (
              <PdfPageHeader
                tenantName={tenant?.name}
                coverTitle={coverTitle}
                clientName={proposal.clientName}
                contentStyles={contentStyles}
              />
            )}

            {/* Items */}
            <div className="flex-1">
              {pageItems.map((item, idx) => (
                <React.Fragment key={idx}>
                  {renderItem(item)}
                </React.Fragment>
              ))}
            </div>

            {/* Page Number */}
            <div className="absolute bottom-6 right-8 text-xs text-muted-foreground z-20">
              {pageIndex + 2}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
