import { Package, Wrench } from "lucide-react";
import type { TenantNiche } from "@/types";
import type { PdfDisplaySettings } from "@/types/pdf-display-settings";
import { PdfItemTypeBadge, PdfMonthlyBadge } from "./pdf-item-type-badge";
import {
  hasProductLineFooterContent,
  PdfProductLineFooter,
} from "./pdf-sistema-primitives";
import { type PdfProduct, resolveProductImages } from "./pdf-sistema-types";

/**
 * Layout "Tabela" do PDF: uma linha por item, com miniatura, nome,
 * descrição e o valor. Cada linha é uma tabela própria com as mesmas larguras
 * de coluna, porque a paginação mede e quebra item a item; assim as linhas
 * continuam alinhadas entre si e com o cabeçalho, inclusive depois de uma
 * quebra de página.
 *
 * O valor sai do mesmo `PdfProductLineFooter` dos cards, então medida,
 * quantidade e preço seguem o formato do nicho em todo layout.
 */

const THUMB_WIDTH = "52px";
const VALUE_WIDTH = "34%";

function TableColumns({ showImages }: { showImages: boolean }) {
  return (
    <colgroup>
      {showImages && <col style={{ width: THUMB_WIDTH }} />}
      <col />
      <col style={{ width: VALUE_WIDTH }} />
    </colgroup>
  );
}

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  tableLayout: "fixed" as const,
};

function valueHeading(settings: PdfDisplaySettings): string {
  if (settings.showProductPrices) return "Valor";
  if (settings.showProductQuantities !== false) return "Quantidade";
  return "";
}

interface FrameProps {
  framed?: boolean;
  primaryColor: string;
  children: React.ReactNode;
}

/** Dentro de um grupo quebrado em páginas, a linha continua a moldura dele. */
function Frame({ framed, primaryColor, children }: FrameProps) {
  if (!framed) return <>{children}</>;
  return (
    <div
      className="border-l-2 border-r-2 bg-white"
      style={{ borderColor: primaryColor, padding: "0 12px" }}
    >
      {children}
    </div>
  );
}

interface PdfProductTableHeadProps {
  settings: PdfDisplaySettings;
  primaryColor: string;
  framed?: boolean;
}

export function PdfProductTableHead({ settings, primaryColor, framed }: PdfProductTableHeadProps) {
  const showImages = settings.showProductImages;
  return (
    <Frame framed={framed} primaryColor={primaryColor}>
      <table data-pdf-product-table-head="1" style={tableStyle}>
        <TableColumns showImages={showImages} />
        <thead>
          <tr style={{ borderBottom: `2px solid ${primaryColor}` }}>
            {showImages && <th />}
            <th className="py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              Item
            </th>
            <th className="py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">
              {valueHeading(settings)}
            </th>
          </tr>
        </thead>
      </table>
    </Frame>
  );
}

interface PdfProductTableRowProps {
  product: PdfProduct;
  settings: PdfDisplaySettings;
  primaryColor: string;
  index: number;
  tenantNiche?: TenantNiche | null;
  framed?: boolean;
}

export function PdfProductTableRow({
  product,
  settings,
  primaryColor,
  index,
  tenantNiche,
  framed,
}: PdfProductTableRowProps) {
  const showImages = settings.showProductImages;
  const image = resolveProductImages(product)[0];
  const PlaceholderIcon = product.itemType === "service" ? Wrench : Package;
  const footerOptions = {
    product,
    tenantNiche,
    showProductPrices: settings.showProductPrices,
    showProductMeasurements: settings.showProductMeasurements,
    showProductQuantities: settings.showProductQuantities,
  };

  return (
    <Frame framed={framed} primaryColor={primaryColor}>
      <table
        data-pdf-product-table-row="1"
        data-pdf-item-id={product.productId}
        style={{
          ...tableStyle,
          backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <TableColumns showImages={showImages} />
        <tbody>
          <tr className="break-inside-avoid">
            {showImages && (
              <td style={{ padding: "6px 8px 6px 4px", verticalAlign: "top" }}>
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded border bg-white">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="h-full w-full object-contain p-0.5" />
                  ) : (
                    <PlaceholderIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </td>
            )}
            <td style={{ padding: "6px 8px 6px 0", verticalAlign: "top" }}>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs font-semibold text-gray-900 wrap-break-word">
                  {product.productName}
                </span>
                {product.isMonthly && <PdfMonthlyBadge />}
                <PdfItemTypeBadge itemType={product.itemType || "product"} />
              </div>
              {settings.showProductDescriptions && product.productDescription && (
                <p className="mt-0.5 text-[10px] leading-snug text-gray-600">
                  {product.productDescription}
                </p>
              )}
            </td>
            <td style={{ padding: "6px 4px 6px 0", verticalAlign: "top", textAlign: "right" }}>
              {hasProductLineFooterContent(footerOptions) && (
                <div
                  style={{
                    display: "inline-flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    lineHeight: "1.2",
                  }}
                >
                  <PdfProductLineFooter
                    {...footerOptions}
                    primaryColor={primaryColor}
                    grayTextClassName="text-[10px] text-gray-500"
                    totalTextClassName="font-semibold text-sm"
                  />
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </Frame>
  );
}

/** A tabela inteira de uma vez, para um grupo pequeno que cabe sem quebrar. */
export function PdfProductTable({
  products,
  settings,
  primaryColor,
  tenantNiche,
}: {
  products: readonly PdfProduct[];
  settings: PdfDisplaySettings;
  primaryColor: string;
  tenantNiche?: TenantNiche | null;
}) {
  return (
    <div className="px-3 py-2">
      <PdfProductTableHead settings={settings} primaryColor={primaryColor} />
      {products.map((product, index) => (
        <PdfProductTableRow
          key={`${product.productId}-${index}`}
          product={product}
          settings={settings}
          primaryColor={primaryColor}
          index={index}
          tenantNiche={tenantNiche}
        />
      ))}
    </div>
  );
}
