import React from "react";
import { formatCurrency } from "@/utils/format-utils";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";
import {
  isProductVisibleInPdf,
  shouldCountInPdfTotals,
} from "../product-visibility";
import type { ProposalProductPricingDetails } from "@/lib/product-pricing";
import type { TenantNiche } from "@/types";
import { PdfSistemaProductCard } from "./pdf-sistema-primitives";
import { compareConfiguredDisplayItemWithExtras } from "@/lib/sort-text";

interface PdfProduct {
  productId: string;
  itemType?: "product" | "service";
  productName: string;
  productImage?: string;
  productImages?: string[];
  productDescription?: string;
  quantity: number;
  unitPrice: number;
  markup?: number;
  total: number;
  pricingDetails?: ProposalProductPricingDetails;
  _isInactive?: boolean;
  _isGhost?: boolean;
  isExtra?: boolean;
}

interface PdfExtraProductsBlockProps {
  products: PdfProduct[];
  primaryColor: string;
  pdfDisplaySettings?: PdfDisplaySettings;
  tenantNiche?: TenantNiche | null;
}

export function PdfExtraProductsBlock({
  products,
  primaryColor,
  pdfDisplaySettings,
  tenantNiche,
}: PdfExtraProductsBlockProps) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const visibleProducts = [...products]
    .filter((product) => isProductVisibleInPdf(product))
    .sort(compareConfiguredDisplayItemWithExtras);
  const productsForTotals = products.filter((product) =>
    shouldCountInPdfTotals(product),
  );
  const extraSubtotal = productsForTotals.reduce(
    (sum: number, p: PdfProduct) => sum + p.total,
    0,
  );

  return (
    <div className="mt-12 mb-4">
      <div className="bg-white">
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: "8px",
            tableLayout: "fixed",
            margin: "0 auto",
            padding: "0 8px",
            boxSizing: "border-box",
          }}
        >
          <tbody>
            {Array.from(
              { length: Math.ceil(visibleProducts.length / 2) },
              (_, rowIdx) => {
                const left = visibleProducts[rowIdx * 2];
                const right = visibleProducts[rowIdx * 2 + 1];

                return (
                  <tr key={rowIdx}>
                    {right ? (
                      <>
                        <td
                          style={{
                            verticalAlign: "top",
                            width: "50%",
                            padding: 0,
                          }}
                        >
                          <PdfSistemaProductCard
                            product={left}
                            primaryColor={primaryColor}
                            settings={settings}
                            evenBackground={(rowIdx * 2) % 2 === 0}
                            tenantNiche={tenantNiche}
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
                            product={right}
                            primaryColor={primaryColor}
                            settings={settings}
                            evenBackground={(rowIdx * 2 + 1) % 2 === 0}
                            tenantNiche={tenantNiche}
                          />
                        </td>
                      </>
                    ) : (
                      <td
                        colSpan={2}
                        style={{ verticalAlign: "top", padding: 0 }}
                      >
                        <PdfSistemaProductCard
                          product={left}
                          primaryColor={primaryColor}
                          settings={settings}
                          evenBackground={(rowIdx * 2) % 2 === 0}
                          tenantNiche={tenantNiche}
                        />
                      </td>
                    )}
                  </tr>
                );
              },
            )}
          </tbody>
        </table>

        {settings.showSubtotals && (
          <div
            className="flex justify-between items-center px-4 pb-3 pt-2"
            style={{ borderTop: `2px dashed ${primaryColor}30` }}
          >
            <span className="font-semibold text-gray-700 text-sm">
              Subtotal:
            </span>
            <span className="text-lg font-bold" style={{ color: primaryColor }}>
              {formatCurrency(extraSubtotal)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
