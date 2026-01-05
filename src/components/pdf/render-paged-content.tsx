import React from "react";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";
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
}

interface Sistema {
  sistemaId: string;
  sistemaName: string;
  ambienteId: string;
  ambienteName: string;
  description?: string;
  productIds?: string[];
}

interface Proposal {
  sistemas?: Sistema[];
  discount?: number;
  clientName: string;
  title?: string;
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
}

/**
 * Builds the list of content items from sections and products
 */
function buildContentItems(
  sections: PdfSection[],
  products: Product[],
  proposal: Proposal
): ContentItem[] {
  const items: ContentItem[] = [];
  const hasSistemas = proposal.sistemas && proposal.sistemas.length > 0;

  const addSistemaProducts = (sistema: Sistema, productsForSistema: Product[]) => {
    const sortedProducts = [...productsForSistema].sort((a: Product, b: Product) => {
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

  const addRegularProducts = (productsToAdd: Product[]) => {
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

  const productSectionIndex = sections.findIndex(s => s.type === 'product-table');

  if (productSectionIndex !== -1) {
    sections.forEach(section => {
      if (section.type === 'product-table') {
        if (hasSistemas) {
          proposal.sistemas!.forEach((sistema: Sistema) => {
            const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
            let productsForSistema = products.filter((p: Product) => p.systemInstanceId === systemInstanceId);

            const isLegacy = !products.some((p: Product) => p.systemInstanceId);
            if (productsForSistema.length === 0 && isLegacy) {
              productsForSistema = products.filter((p: Product) => sistema.productIds?.includes(p.productId));
            }

            if (productsForSistema.length > 0) {
              addSistemaProducts(sistema, productsForSistema);
            }
          });

          const sistemaProductIds = new Set(
            proposal.sistemas!.flatMap((s: Sistema) => s.productIds || [])
          );
          const extraProducts = products.filter((p: Product) => !p.systemInstanceId && !sistemaProductIds.has(p.productId));

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
          proposal.sistemas!.forEach((sistema: Sistema) => {
            const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
            let productsForSistema = products.filter((p: Product) => p.systemInstanceId === systemInstanceId);

            const isLegacy = !products.some((p: Product) => p.systemInstanceId);
            if (productsForSistema.length === 0 && isLegacy) {
              productsForSistema = products.filter((p: Product) => sistema.productIds?.includes(p.productId));
            }

            if (productsForSistema.length > 0) {
              addSistemaProducts(sistema, productsForSistema);
            }
          });

          const sistemaProductIds = new Set(
            proposal.sistemas!.flatMap((s: Sistema) => s.productIds || [])
          );
          const extraProducts = products.filter((p: Product) => !p.systemInstanceId && !sistemaProductIds.has(p.productId));

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
        proposal.sistemas!.forEach((sistema: Sistema) => {
          const productsForSistema = products.filter((p: Product) =>
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
 * Distributes content items across pages
 */
function distributeIntoPages(items: ContentItem[]): ContentItem[][] {
  const pages: ContentItem[][] = [];
  let currentPage: ContentItem[] = [];
  let currentHeight = ESTIMATED_HEIGHTS.HEADER;

  items.forEach((item, index) => {
    let forceBreak = false;

    if (item.type === "product-header" || (item.type === "section" && item.data?.type === "title")) {
      const nextItem = items[index + 1];
      if (nextItem && currentHeight + item.height + nextItem.height > SAFE_HEIGHT) {
        forceBreak = true;
      }
    }

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
  const items = buildContentItems(sections, products, proposal);
  const pages = distributeIntoPages(items);

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
          className="mx-auto bg-white shadow-sm mb-8"
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
                contentStyles={contentStyles}
              />
            )}

            {/* Main Content - Grows to fill space */}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
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
