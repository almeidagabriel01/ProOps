import * as React from "react";

import { Product } from "@/services/product-service";
import { Service } from "@/services/service-service";
import { ProposalProduct } from "@/services/proposal-service";
import { ProposalSistema } from "@/types/automation";
import { ProposalWorkflow } from "@/lib/niches/config";
import { ProductRow } from "./product-row";
import { SystemGroupRows } from "./system-group-rows";
import { SummaryFooter } from "./summary-footer";
import { compareConfiguredDisplayItem } from "@/lib/sort-text";

interface ProposalSummaryTableProps {
  selectedProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  extraProducts: ProposalProduct[];
  proposalWorkflow: ProposalWorkflow;
  primaryColor: string;
  products: Array<Product | Service>;
  subtotal: number;
  discount: number;
  discountPercentage: number;
  extraExpense: number;
  totalValue: number;
  closedValue?: number | null;
}

export function ProposalSummaryTable({
  selectedProducts,
  selectedSistemas,
  extraProducts,
  proposalWorkflow,
  primaryColor,
  products,
  subtotal,
  discount,
  discountPercentage,
  extraExpense,
  totalValue,
  closedValue,
}: ProposalSummaryTableProps) {
  const displaySelectedProducts = [...selectedProducts]
    .filter((product) => product.quantity > 0)
    .sort(compareConfiguredDisplayItem);
  const displayExtraProducts = [...extraProducts]
    .filter((product) => product.quantity > 0)
    .sort(compareConfiguredDisplayItem);
  const usesGroupedRows =
    proposalWorkflow === "automation" || proposalWorkflow === "environment";
  const extraItemsLabel =
    proposalWorkflow === "automation"
      ? "Produtos Extras (não vinculados a sistemas)"
      : "Produtos Extras (não vinculados a ambientes)";

  const isProductInactive = (product: ProposalProduct) => {
    const catalogProduct = products.find(
      (item) => item.id === product.productId,
    );
    return (
      catalogProduct?.status === "inactive" || product.status === "inactive"
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3">Item</th>
            <th className="text-right p-3 w-36">Unit.</th>
            <th className="text-right p-3 w-36">Total</th>
          </tr>
        </thead>
        <tbody>
          {usesGroupedRows && (
            <SystemGroupRows
              selectedSistemas={selectedSistemas}
              selectedProducts={displaySelectedProducts}
              primaryColor={primaryColor}
              isProductInactive={isProductInactive}
              mode={proposalWorkflow}
            />
          )}

          {usesGroupedRows && displayExtraProducts.length > 0 && (
            <React.Fragment>
              <tr className="border-t bg-gray-100">
                <td
                  colSpan={3}
                  className="p-2 font-semibold text-sm text-gray-600 dark:text-gray-300"
                >
                  {extraItemsLabel}
                </td>
              </tr>
              {displayExtraProducts.map((product) => (
                <ProductRow
                  key={`${product.productId}-${product.itemType || "product"}`}
                  product={product}
                  isInactive={isProductInactive(product)}
                />
              ))}
            </React.Fragment>
          )}

          {!usesGroupedRows &&
            displaySelectedProducts.map((product) => (
              <ProductRow
                key={`${product.productId}-${product.itemType || "product"}`}
                product={product}
                isInactive={isProductInactive(product)}
              />
            ))}
        </tbody>
        <SummaryFooter
          selectedProducts={displaySelectedProducts}
          subtotal={subtotal}
          discount={discount}
          discountPercentage={discountPercentage}
          extraExpense={extraExpense}
          totalValue={totalValue}
          closedValue={closedValue}
        />
      </table>
    </div>
  );
}
