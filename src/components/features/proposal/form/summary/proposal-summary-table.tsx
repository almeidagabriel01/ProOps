import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/services/product-service";
import { ProposalProduct } from "@/services/proposal-service";
import { ProposalSistema } from "@/types/automation";
import { ProductRow } from "./product-row";
import { SystemGroupRows } from "./system-group-rows";
import { SummaryFooter } from "./summary-footer";

interface ProposalSummaryTableProps {
  selectedProducts: ProposalProduct[];
  selectedSistemas: ProposalSistema[];
  extraProducts: ProposalProduct[];
  isAutomacaoNiche: boolean;
  primaryColor: string;
  products: Product[];
  subtotal: number;
  discount: number;
  discountPercentage: number;
  extraExpense: number;
  totalValue: number;
}

export function ProposalSummaryTable({
  selectedProducts,
  selectedSistemas,
  extraProducts,
  isAutomacaoNiche,
  primaryColor,
  products,
  subtotal,
  discount,
  discountPercentage,
  extraExpense,
  totalValue,
}: ProposalSummaryTableProps) {
  // Helper to check if product is inactive
  const isProductInactive = (product: ProposalProduct) => {
    // Check if product is inactive in catalog OR marked as inactive in proposal
    const catalogProduct = products.find((p) => p.id === product.productId);
    return (
      catalogProduct?.status === "inactive" || product.status === "inactive"
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-3">Produto</th>
            <th className="text-center p-3 w-16">Qtd</th>
            <th className="text-right p-3 w-36">Unit.</th>
            <th className="text-right p-3 w-36">Total</th>
          </tr>
        </thead>
        <tbody>
          {/* Produtos agrupados por sistema (Automacao) */}
          {isAutomacaoNiche && (
            <SystemGroupRows
              selectedSistemas={selectedSistemas}
              selectedProducts={selectedProducts}
              primaryColor={primaryColor}
              isProductInactive={isProductInactive}
            />
          )}

          {/* Produtos extras (Automacao) */}
          {isAutomacaoNiche && extraProducts.length > 0 && (
            <React.Fragment>
              <tr className="border-t bg-gray-100">
                <td
                  colSpan={4}
                  className="p-2 font-semibold text-sm text-gray-600 dark:text-gray-300"
                >
                  📦 Produtos Extras (não vinculados a sistemas)
                </td>
              </tr>
              {extraProducts.map((product) => (
                <ProductRow
                  key={product.productId}
                  product={product}
                  isInactive={isProductInactive(product)}
                />
              ))}
            </React.Fragment>
          )}

          {/* Para nicho não-automação */}
          {!isAutomacaoNiche &&
            selectedProducts.map((product) => (
              <ProductRow
                key={product.productId}
                product={product}
                isInactive={isProductInactive(product)}
              />
            ))}
        </tbody>
        <SummaryFooter
          selectedProducts={selectedProducts}
          subtotal={subtotal}
          discount={discount}
          discountPercentage={discountPercentage}
          extraExpense={extraExpense}
          totalValue={totalValue}
        />
      </table>
    </div>
  );
}
