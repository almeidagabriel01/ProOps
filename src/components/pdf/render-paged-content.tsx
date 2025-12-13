import React from "react";
import { PdfSection } from "@/components/features/proposal/pdf-section-editor";

// Helper to estimate heights (in px, assuming 96DPI approx)
// A4 Height is ~1123px. We use a safe content area of ~1000px.
const PAGE_HEIGHT_PX = 1080;
const CONTENT_MARGIN_Y = 96; // 48px top + 48px bottom
const SAFE_HEIGHT = PAGE_HEIGHT_PX - CONTENT_MARGIN_Y;

const ESTIMATED_HEIGHTS = {
  HEADER: 150,
  SECTION_PADDING: 24,
  LINE_HEIGHT: 24,
  IMAGE_DEFAULT: 300,
  PRODUCT_HEADER: 80,
  PRODUCT_ROW: 250,
  TOTALS: 200,
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Helper para calcular cor de texto com contraste adequado
const getContrastTextColor = (hexColor: string): string => {
  // Remove # se presente
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calcula luminosidade (fórmula WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
};

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
  // 1. Flatten all content into a measurable list
  const items: any[] = [];

  // Check if proposal has sistemas (automation niche)
  const hasSistemas = proposal.sistemas && proposal.sistemas.length > 0;
  
  // Helper to add products for a specific sistema as a single block
  const addSistemaProducts = (sistema: any, productsForSistema: any[]) => {
    // Sort products: Standard first, then Extras
    const sortedProducts = [...productsForSistema].sort((a: any, b: any) => {
      if (a.isExtra && !b.isExtra) return 1;
      if (!a.isExtra && b.isExtra) return -1;
      return 0;
    });

    // 1. Header
    items.push({
      type: "sistema-container-header",
      data: { sistema },
      height: 120, // Header height
    });

    // 2. Products
    sortedProducts.forEach((product, idx) => {
      let h = 80; // Compact product row height
      if ((product.productImages && product.productImages.length > 0) || product.productImage) {
        h += 100;
      }
      // Add padding/margin overhead for the wrapper
      h += 20; 

      items.push({
        type: "sistema-container-product",
        data: { product, isLast: idx === sortedProducts.length - 1 },
        height: h
      });
    });

    // 3. Footer
    items.push({
      type: "sistema-container-footer",
      data: { 
        subtotal: sortedProducts.reduce((sum: number, p: any) => sum + p.total, 0) 
      },
      height: 80 // Footer height
    });
  };

  // Helper to add regular products
  const addRegularProducts = (productsToAdd: any[]) => {
    if (productsToAdd.length > 0) {
      items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
      productsToAdd.forEach((product, i) => {
        let h = 150;
        if ((product.productImages && product.productImages.length > 0) || product.productImage) {
          h += 200;
        }
        if (product.productDescription && product.productDescription.length > 50) {
          h += 20;
        }
        items.push({
          type: "product-row",
          data: { ...product, index: i },
          height: h,
        });
      });
      items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
    }
  };

  
  // 1. Check if there's an explicit "product-table" section
  const productSectionIndex = sections.findIndex(s => s.type === 'product-table');
  
  if (productSectionIndex !== -1) {
    // EXPLICIT MODE: Render sections, replacing the product-table section with actual products
    sections.forEach(section => {
        if (section.type === 'product-table') {
            // Render products here
            if (hasSistemas) {
              // AUTOMATION MODE: Group products by sistema
              proposal.sistemas.forEach((sistema: any) => {
                const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
                let productsForSistema = products.filter((p: any) => p.systemInstanceId === systemInstanceId);
                
                // Fallback for legacy
                const isLegacy = !products.some((p: any) => p.systemInstanceId);
                if (productsForSistema.length === 0 && isLegacy) {
                   productsForSistema = products.filter((p: any) => sistema.productIds?.includes(p.productId));
                }

                if (productsForSistema.length > 0) {
                  addSistemaProducts(sistema, productsForSistema);
                }
              });

              // Add extra products (not in any sistema) as a single block
              const sistemaProductIds = new Set(
                proposal.sistemas.flatMap((s: any) => s.productIds || [])
              );
              // Filter out products that have instance ID OR are in claimed IDs set
              const extraProducts = products.filter((p: any) => !p.systemInstanceId && !sistemaProductIds.has(p.productId));
              if (extraProducts.length > 0) {
                // Calculate total height for the block
                let blockHeight = 140; // Base height for header
                extraProducts.forEach((product) => {
                  let h = 80;
                  if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                    h += 100;
                  }
                  blockHeight += h;
                });
                blockHeight += 60; // Subtotal
                
                items.push({
                  type: "extra-products-block",
                  data: {
                    products: extraProducts,
                  },
                  height: blockHeight,
                });
              }
              items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
            } else {
              // Regular mode
             if (products.length > 0) {
                items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
                products.forEach((product, i) => {
                  let h = 150; 
                  if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                     h += 200; 
                  }
                  if (product.productDescription && product.productDescription.length > 50) {
                    h += 20; 
                  }
                  items.push({
                    type: "product-row",
                    data: { ...product, index: i },
                    height: h,
                  });
                });
                items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
             }
            }
        } else {
            // Render normal section
            let height = ESTIMATED_HEIGHTS.SECTION_PADDING;
            if (section.type === "text") {
              const lines = section.content.split("\n").length;
              height += lines * ESTIMATED_HEIGHTS.LINE_HEIGHT;
              // Add extra for margins
              if (section.styles.marginTop)
                height += parseInt(section.styles.marginTop as string) || 0;
              if (section.styles.marginBottom)
                height += parseInt(section.styles.marginBottom as string) || 0;
            } else if (section.type === "image") {
              height += ESTIMATED_HEIGHTS.IMAGE_DEFAULT;
            } else if (section.type === "divider") {
              height += 20;
            }
             items.push({
                type: "section",
                data: section,
                height: height
             });
        }
    });
  } else {
    // SMART FALLBACK MODE (Legacy behavior + Improvements)
    // Find a good spot for products: Before "Garantia", "Termos", "Obrigado" or "Considerações Finais"
    // OR if not found, after the Introduction (usually first text section)
    
    let insertIndex = -1;
    const footerKeywords = ["garantia", "termos", "condições", "considerações", "obrigado", "agradecemos", "validade"];
    
    // Check titles/content to find a footer section
    for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        const text = (s.content || "").toLowerCase();
        if (footerKeywords.some(k => text.includes(k))) {
            insertIndex = i;
            break;
        }
    }
    
    // If no footer section found, put it after the first 2 sections (Header + Intro roughly)
    // Or if only 1 section, put it at end.
    if (insertIndex === -1) {
        insertIndex = sections.length > 1 ? 1 : sections.length;
    }

    // Iterate and insert
    for (let i = 0; i < sections.length; i++) {
        // If this is the insertion point, add products first
        if (i === insertIndex) {
             if (hasSistemas) {
               // AUTOMATION MODE: Group products by sistema
               proposal.sistemas.forEach((sistema: any)  => {
                 const systemInstanceId = `${sistema.sistemaId}-${sistema.ambienteId}`;
                 let productsForSistema = products.filter((p: any) => p.systemInstanceId === systemInstanceId);
                 
                 // Fallback for legacy
                 const isLegacy = !products.some((p: any) => p.systemInstanceId);
                 if (productsForSistema.length === 0 && isLegacy) {
                    productsForSistema = products.filter((p: any) => sistema.productIds?.includes(p.productId));
                 }

                 if (productsForSistema.length > 0) {
                   addSistemaProducts(sistema, productsForSistema);
                 }
               });

               // Add extra products (not in any sistema)
               const sistemaProductIds = new Set(
                 proposal.sistemas.flatMap((s: any) => s.productIds || [])
               );
               const extraProducts = products.filter((p: any) => !p.systemInstanceId && !sistemaProductIds.has(p.productId));
               if (extraProducts.length > 0) {
                 items.push({
                   type: "extra-products-header",
                   height: 60,
                 });
                 extraProducts.forEach((product, idx) => {
                   let h = 150;
                   if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                     h += 200;
                   }
                   items.push({
                     type: "product-row",
                     data: { ...product, index: idx },
                     height: h,
                   });
                 });
               }
               items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
             } else if (products.length > 0) {
                items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
                products.forEach((product, idx) => {
                  let h = 150; 
                  if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                     h += 200; 
                  }
                  if (product.productDescription && product.productDescription.length > 50) {
                    h += 20; 
                  }
                  items.push({
                    type: "product-row",
                    data: { ...product, index: idx },
                    height: h,
                  });
                });
                items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
             }
        }
        
        // Add the section
        const section = sections[i];
        let height = ESTIMATED_HEIGHTS.SECTION_PADDING;
        if (section.type === "text") {
          const lines = section.content.split("\n").length;
          height += lines * ESTIMATED_HEIGHTS.LINE_HEIGHT;
          // Add extra for margins
          if (section.styles.marginTop)
            height += parseInt(section.styles.marginTop as string) || 0;
          if (section.styles.marginBottom)
            height += parseInt(section.styles.marginBottom as string) || 0;
        } else if (section.type === "image") {
          height += ESTIMATED_HEIGHTS.IMAGE_DEFAULT;
        } else if (section.type === "divider") {
          height += 20;
        }
         items.push({
            type: "section",
            data: section,
            height: height
         });
    }
    
    // If insertion point was at the very end
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
            items.push({ type: "product-header", height: ESTIMATED_HEIGHTS.PRODUCT_HEADER });
            products.forEach((product, idx) => {
                  let h = 150; 
                  if ((product.productImages && product.productImages.length > 0) || product.productImage) {
                     h += 200; 
                  }
                  if (product.productDescription && product.productDescription.length > 50) {
                    h += 20; 
                  }
              items.push({
                type: "product-row",
                data: { ...product, index: idx },
                height: h,
              });
            });
            items.push({ type: "totals", height: ESTIMATED_HEIGHTS.TOTALS });
         }
    }
  }

  // 2. Distribute into pages
  const pages: any[][] = [];
  let currentPage: any[] = [];
  let currentHeight = ESTIMATED_HEIGHTS.HEADER;

  items.forEach((item, index) => {
    let forceBreak = false;
    
    // Orphan Control: If we have a header/title, check if the NEXT item fits.
    // If not, break page now so header stays with content.
    if (item.type === "product-header" || (item.type === "section" && item.data.type === "title")) {
        const nextItem = items[index + 1];
        if (nextItem) {
            // Check if adding BOTH fits. If not, break.
            if (currentHeight + item.height + nextItem.height > SAFE_HEIGHT) {
                forceBreak = true;
            }
        }
    }
    
    // Para sistema-block e extra-products-block, se não couber inteiro, nova página
    if (item.type === "sistema-block" || item.type === "extra-products-block") {
        if (currentHeight + item.height > SAFE_HEIGHT && currentHeight > ESTIMATED_HEIGHTS.HEADER) {
            forceBreak = true;
        }
    }

    if (forceBreak || currentHeight + item.height > SAFE_HEIGHT) {
      // Push current page
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 60; // Margin for next page top
    }
    currentPage.push(item);
    currentHeight += item.height;
  });

  // Push last page
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // Helper to render an item
  const renderItem = (item: any, pageIndex: number) => {
    switch (item.type) {
      case "section":
        return (
          <div
            key={item.data.id}
            style={{
              width: `${item.data.columnWidth || 100}%`,
              padding:
                item.data.columnWidth && item.data.columnWidth < 100
                  ? "0 8px"
                  : undefined,
              boxSizing: "border-box",
              // Inline styles from original
              marginTop: item.data.styles.marginTop,
              marginBottom: item.data.styles.marginBottom,
            }}
          >
            <div
              style={{
                fontSize: item.data.styles.fontSize,
                fontWeight: item.data.styles.fontWeight,
                fontStyle: item.data.styles.fontStyle,
                textAlign: item.data.styles.textAlign,
                color:
                  item.data.styles.color ||
                  (item.data.type === "title"
                    ? contentStyles.headerTitle?.color || primaryColor
                    : contentStyles.sectionText?.color),
                backgroundColor:
                  item.data.styles.backgroundColor === "transparent"
                    ? undefined
                    : item.data.styles.backgroundColor,
                padding:
                  item.data.styles.backgroundColor &&
                  item.data.styles.backgroundColor !== "transparent"
                    ? "12px"
                    : undefined,
                borderRadius:
                  item.data.styles.backgroundColor &&
                  item.data.styles.backgroundColor !== "transparent"
                    ? "8px"
                    : undefined,
              }}
            >
              {item.data.type === "divider" ? (
                <hr style={{ borderTop: `2px solid ${primaryColor}` }} />
              ) : item.data.type === "image" ? (
                <div
                  style={{ textAlign: item.data.styles.imageAlign || "center" }}
                >
                  {item.data.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.data.imageUrl}
                      alt=""
                      style={{
                        width: `${item.data.styles.imageWidth || 100}%`,
                        maxWidth: "100%",
                        borderRadius:
                          item.data.styles.imageBorderRadius || "8px",
                        border: item.data.styles.imageBorder
                          ? "2px solid #e5e7eb"
                          : "none",
                        display: "inline-block",
                      }}
                    />
                  )}
                  {item.data.content && (
                    <p className="text-sm text-gray-500 mt-2">
                      {item.data.content}
                    </p>
                  )}
                </div>
              ) : (
                item.data.content.split("\n").map((line: string, i: number) => (
                  <React.Fragment key={i}>
                    {line}
                    {i < item.data.content.split("\n").length - 1 && <br />}
                  </React.Fragment>
                ))
              )}
            </div>
          </div>
        );
      case "sistema-container-header":
        const sistemaHeaderInfo = item.data.sistema;
        return (
          <div className="mt-6">
            {/* Header do Sistema - Topo do Container */}
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
                <div className="flex items-center gap-4">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow"
                        style={{ 
                          backgroundColor: primaryColor,
                          color: getContrastTextColor(primaryColor),
                        }}
                      >
                        📍 {sistemaHeaderInfo.ambienteName}
                      </span>
                    </div>
                    <h3 
                      className="text-2xl font-bold"
                      style={{ color: primaryColor }}
                    >
                      {sistemaHeaderInfo.sistemaName}
                    </h3>
                    {sistemaHeaderInfo.description && (
                      <p className="mt-1 text-sm text-gray-600 leading-relaxed break-words">
                        {sistemaHeaderInfo.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "sistema-container-product":
        const productItem = item.data.product;
        return (
          <div 
            className="border-x-2 bg-white px-4 py-2"
            style={{ borderColor: primaryColor }}
          >
            <div
              className={`flex items-center gap-4 p-4 rounded-lg border ${productItem.isExtra ? 'bg-blue-50/50 border-blue-100' : ''}`}
              style={{ 
                backgroundColor: productItem.isExtra ? '#eff6ff' : '#ffffff',
                borderColor: productItem.isExtra ? '#bfdbfe' : '#e5e7eb',
              }}
            >
              {/* Imagem do produto (se houver) */}
              {(productItem.productImage || (productItem.productImages && productItem.productImages.length > 0)) && (
                <div className="w-16 h-16 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productItem.productImages?.[0] || productItem.productImage}
                    alt=""
                    className="w-full h-full object-contain p-1"
                  />
                </div>
              )}
              
              {/* Info do produto */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900 truncate">{productItem.productName}</h4>
                  {productItem.isExtra && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                      Extra
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {productItem.quantity} un. × {formatCurrency(productItem.unitPrice)}
                </p>
              </div>
              
              {/* Valor */}
              <div className="text-right">
                <span className="font-bold text-lg" style={{ color: primaryColor }}>
                  {formatCurrency(productItem.total)}
                </span>
              </div>
            </div>
          </div>
        );
      case "sistema-container-footer":
        return (
          <div className="mb-6">
            <div 
              className="rounded-b-xl border-2 border-t-0 bg-white p-4"
              style={{ borderColor: primaryColor }}
            >
              <div 
                className="flex justify-between items-center pt-2"
                style={{ borderTop: `2px dashed ${primaryColor}30` }}
              >
                <span className="font-semibold text-gray-700">Subtotal do Sistema:</span>
                <span 
                  className="text-xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {formatCurrency(item.data.subtotal)}
                </span>
              </div>
            </div>
          </div>
        );
      case "sistema-block":
        const sistemaBlockData = item.data;
        const sistemaInfo = sistemaBlockData.sistema;
        const sistemaProductsList = sistemaBlockData.products;
        const sistemaSubtotal = sistemaProductsList.reduce((sum: number, p: any) => sum + p.total, 0);
        
        return (
          <div className="mt-6 mb-4">
            {/* Container unificado para Sistema + Produtos */}
            <div 
              className="rounded-xl border-2 overflow-hidden"
              style={{ borderColor: primaryColor }}
            >
              {/* Header do Sistema */}
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow"
                        style={{ 
                          backgroundColor: primaryColor,
                          color: getContrastTextColor(primaryColor),
                        }}
                      >
                        📍 {sistemaInfo.ambienteName}
                      </span>
                    </div>
                    <h3 
                      className="text-2xl font-bold"
                      style={{ color: primaryColor }}
                    >
                      {sistemaInfo.sistemaName}
                    </h3>
                    {sistemaInfo.description && (
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        {sistemaInfo.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Produtos do Sistema */}
              <div className="p-4 space-y-3 bg-white">
                {sistemaProductsList.map((product: any, idx: number) => (
                  <div
                    key={product.productId}
                    className="flex items-center gap-4 p-4 rounded-lg border"
                    style={{ 
                      backgroundColor: idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                      borderColor: '#e5e7eb',
                    }}
                  >
                    {/* Imagem do produto (se houver) */}
                    {(product.productImage || (product.productImages && product.productImages.length > 0)) && (
                      <div className="w-16 h-16 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.productImages?.[0] || product.productImage}
                          alt=""
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                    )}
                    
                    {/* Info do produto */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{product.productName}</h4>
                      <p className="text-sm text-gray-500">
                        {product.quantity} un. × {formatCurrency(product.unitPrice)}
                      </p>
                    </div>
                    
                    {/* Valor */}
                    <div className="text-right">
                      <span className="font-bold text-lg" style={{ color: primaryColor }}>
                        {formatCurrency(product.total)}
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Subtotal do Sistema */}
                <div 
                  className="flex justify-between items-center pt-3 mt-2"
                  style={{ borderTop: `2px dashed ${primaryColor}30` }}
                >
                  <span className="font-semibold text-gray-700">Subtotal do Sistema:</span>
                  <span 
                    className="text-xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(sistemaSubtotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case "sistema-extras-block":
        const sistemaExtrasData = item.data;
        const sistemaExtrasInfo = sistemaExtrasData.sistema;
        const sistemaExtrasList = sistemaExtrasData.products;
        const sistemaExtrasSubtotal = sistemaExtrasList.reduce((sum: number, p: any) => sum + p.total, 0);
        
        return (
          <div className="mt-2 mb-4 ml-4">
            {/* Container unificado para Extras do Sistema */}
            <div 
              className="rounded-xl border-2 overflow-hidden"
              style={{ borderColor: primaryColor, borderStyle: 'dashed' }}
            >
              {/* Header do Sistema Extra */}
              <div 
                className="p-3"
                style={{ 
                  background: `linear-gradient(135deg, ${primaryColor}10 0%, ${primaryColor}05 100%)`,
                  borderBottom: `2px dashed ${primaryColor}30`,
                }}
              >
                <div className="flex items-center gap-4">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shadow"
                        style={{ 
                          backgroundColor: '#dbeafe', // blue-100
                          color: '#1e40af', // blue-800
                        }}
                      >
                        Extra
                      </span>
                    </div>
                    <h3 
                      className="text-lg font-bold"
                      style={{ color: primaryColor }}
                    >
                      Extras - {sistemaExtrasInfo.sistemaName}
                    </h3>
                  </div>
                </div>
              </div>
              
              {/* Produtos Extras do Sistema */}
              <div className="p-3 space-y-2 bg-white">
                {sistemaExtrasList.map((product: any, idx: number) => (
                  <div
                    key={product.productId}
                    className="flex items-center gap-4 p-3 rounded-lg border"
                    style={{ 
                      backgroundColor: '#f0f9ff', // light blue bg
                      borderColor: '#bfdbfe', // light blue border
                    }}
                  >
                    {/* Imagem do produto (se houver) */}
                    {(product.productImage || (product.productImages && product.productImages.length > 0)) && (
                      <div className="w-12 h-12 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.productImages?.[0] || product.productImage}
                          alt=""
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                    )}
                    
                    {/* Info do produto */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate text-sm">{product.productName}</h4>
                      <p className="text-xs text-gray-500">
                        {product.quantity} un. × {formatCurrency(product.unitPrice)}
                      </p>
                    </div>
                    
                    {/* Valor */}
                    <div className="text-right">
                      <span className="font-bold text-base" style={{ color: primaryColor }}>
                        {formatCurrency(product.total)}
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Subtotal do Sistema Extra */}
                <div 
                  className="flex justify-between items-center pt-2 mt-2"
                  style={{ borderTop: `2px dashed ${primaryColor}30` }}
                >
                  <span className="font-semibold text-gray-700 text-sm">Subtotal Extras:</span>
                  <span 
                    className="text-lg font-bold"
                    style={{ color: primaryColor }}
                  >
                    {formatCurrency(sistemaExtrasSubtotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case "sistema-header":
        return (
          <div className="mt-8 mb-4">
            {/* Separador visual antes do sistema */}
            <div 
              className="h-1 w-full rounded-full mb-4"
              style={{ backgroundColor: primaryColor, opacity: 0.3 }}
            />
            
            {/* Card do Sistema */}
            <div 
              className="p-5 rounded-xl border-2 shadow-sm"
              style={{ 
                borderColor: primaryColor,
                background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)`,
              }}
            >
              {/* Header com ícone e badge do ambiente */}
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span 
                      className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      📍 {item.data.ambienteName}
                    </span>
                  </div>
                  <h3 
                    className="text-xl font-bold"
                    style={{ color: primaryColor }}
                  >
                    {item.data.sistemaName}
                  </h3>
                  {item.data.description && (
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      {item.data.description}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Indicador de produtos */}
              <div 
                className="mt-4 pt-3 border-t text-xs font-medium uppercase tracking-wide"
                style={{ borderColor: `${primaryColor}30`, color: primaryColor }}
              >
                Produtos deste sistema:
              </div>
            </div>
          </div>
        );
      case "extra-products-block":
        const extraBlockData = item.data;
        const extraProductsList = extraBlockData.products;
        const extraSubtotal = extraProductsList.reduce((sum: number, p: any) => sum + p.total, 0);
        
        return (
          <div className="mt-6 mb-4">
            {/* Container unificado para Produtos Extras - Estilo idêntico ao System Block */}
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow"
                        style={{ 
                          backgroundColor: primaryColor,
                          color: getContrastTextColor(primaryColor),
                        }}
                      >
                        📍 Avulso
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold" style={{ color: primaryColor }}>
                      Produtos Extras
                    </h3>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                      Itens adicionais não vinculados a sistemas específicos
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Produtos Extras */}
              <div className="p-4 space-y-3 bg-white">
                {extraProductsList.map((product: any, idx: number) => (
                  <div
                    key={product.productId}
                    className="flex items-center gap-4 p-4 rounded-lg border"
                    style={{ 
                      backgroundColor: idx % 2 === 0 ? '#f9fafb' : '#ffffff',
                      borderColor: '#e5e7eb',
                    }}
                  >
                    {/* Imagem do produto (se houver) */}
                    {(product.productImage || (product.productImages && product.productImages.length > 0)) && (
                      <div className="w-16 h-16 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.productImages?.[0] || product.productImage}
                          alt=""
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                    )}
                    
                    {/* Info do produto */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 truncate">{product.productName}</h4>
                      <p className="text-sm text-gray-500">
                        {product.quantity} un. × {formatCurrency(product.unitPrice)}
                      </p>
                    </div>
                    
                    {/* Valor */}
                    <div className="text-right">
                      <span className="font-bold text-lg text-gray-700">
                        {formatCurrency(product.total)}
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Subtotal Extras */}
                <div 
                  className="flex justify-between items-center pt-3 mt-2"
                  style={{ borderTop: '2px dashed #d1d5db' }}
                >
                  <span className="font-semibold text-gray-700">Subtotal Extras:</span>
                  <span className="text-xl font-bold text-gray-700">
                    {formatCurrency(extraSubtotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case "extra-products-header":
        // Mantido para compatibilidade, mas não deve ser usado mais
        return null;
      case "product-header":
        return (
          <h2
            className="text-xl font-bold mb-4 pb-2 border-b-2 mt-4"
            style={contentStyles.productTitle}
          >
            Produtos e Serviços
          </h2>
        );
      case "product-row":
        const product = item.data;
        const i = product.index;
        return (
          <div
            className="flex flex-col gap-4 p-6 rounded-lg border mb-4 break-inside-avoid"
            style={
              i % 2 === 0
                ? contentStyles.productCardAlt
                : contentStyles.productCard
            }
          >
            {/* Image Row - Horizontal */}
            <div className="flex flex-row gap-4 overflow-hidden justify-center mb-4">
              {product.productImages && product.productImages.length > 0 ? (
                product.productImages.map((img: string, idx: number) => (
                  <div key={idx} className="w-48 h-48 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`Product ${idx}`}
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                ))
              ) : product.productImage ? (
                 <div className="w-48 h-48 bg-white rounded-lg border overflow-hidden flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.productImage}
                      alt=""
                      className="w-full h-full object-contain p-2"
                    />
                   </div>
              ) : null}
            </div>

            {/* Content Column */}
            <div className="flex-1 flex flex-col gap-2">
              <div>
                <div className="mb-2">
                  <div className="flex justify-between items-start">
                    <span className="text-lg font-bold text-gray-900 leading-tight">
                      {product.productName}
                    </span>
                  </div>
                  
                  {/* Category/Manufacturer Badges - Moved here */}
                  {(product.category || product.manufacturer) && (
                    <div className="flex gap-2 mt-1">
                      {product.category && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                          {product.category}
                        </span>
                      )}
                      {product.manufacturer && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-medium text-gray-600 uppercase tracking-wide">
                          {product.manufacturer}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {product.productDescription && (
                  <div
                    className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed"
                    style={contentStyles.productSub}
                  >
                    {product.productDescription}
                  </div>
                )}
              </div>

              {/* Footer / Specs */}
              <div className="mt-4 pt-3 border-t flex justify-between items-end">
                 {/* Left side of footer (can be used for SKU or other info if needed) */}
                 <div className="text-sm text-gray-400">
                    {/* Placeholder for future SKU or code */}
                 </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-1">
                    {product.quantity} un. x {formatCurrency(product.unitPrice)}
                  </div>
                  <div className="text-lg font-bold whitespace-nowrap" style={contentStyles.total}>
                    {formatCurrency(product.total)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "totals":
        const subtotal = products.reduce((sum, p) => sum + p.total, 0);
        const discountAmt = (subtotal * (proposal.discount || 0)) / 100;
        const total = subtotal - discountAmt;
        return (
          <div
            className="mt-4 pt-4 border-t-2 flex justify-end"
            style={contentStyles.headerBorder}
          >
            <div className="w-48 space-y-1 text-right">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {proposal.discount && proposal.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>-{formatCurrency(discountAmt)}</span>
                </div>
              )}
              <div
                className="flex justify-between text-xl font-bold pt-2 border-t"
                style={contentStyles.total}
              >
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
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

          {/* Page Content Wrapper */}
          <div className="p-12 relative z-10 h-full flex flex-col">
            {/* Header */}
            {(pageIndex === 0 || repeatHeader) && (
              <div
                className="flex items-start justify-between border-b-2 pb-6 mb-4"
                style={contentStyles.headerBorder}
              >
                <div
                  className="text-2xl font-bold"
                  style={contentStyles.headerTitle}
                >
                  {tenant?.name}
                </div>
                <div
                  className="text-right text-sm"
                  style={contentStyles.headerSub}
                >
                  <div
                    className="font-semibold text-lg"
                    style={{ color: "inherit" }}
                  >
                    {coverTitle}
                  </div>
                  <div>{proposal.clientName}</div>
                </div>
              </div>
            )}

            {/* Items */}
            <div className="flex-1">
              {pageItems.map((item, idx) => (
                <React.Fragment key={idx}>
                  {renderItem(item, pageIndex)}
                </React.Fragment>
              ))}
            </div>

            {/* Page Number - Absolute Position */}
            <div className="absolute bottom-6 right-8 text-xs text-muted-foreground z-20">
              {pageIndex + 2}
            </div>
          </div>
        </div>
      ))}
    </>
  );
};
