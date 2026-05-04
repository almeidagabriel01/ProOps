import { ProposalProduct } from "@/services/proposal-service";

interface SummaryFooterProps {
  selectedProducts: ProposalProduct[];
  subtotal: number;
  discount: number;
  discountPercentage: number;
  extraExpense: number;
  totalValue: number;
  closedValue?: number | null;
}

export function SummaryFooter({
  selectedProducts,
  subtotal,
  discount,
  discountPercentage,
  extraExpense,
  totalValue,
  closedValue,
}: SummaryFooterProps) {
  // Calculate profit from markup
  const totalProfit = selectedProducts.reduce((sum, p) => {
    const basePrice = (p.unitPrice || 0) * p.quantity;
    const profit = basePrice * ((p.markup || 0) / 100);
    return sum + profit;
  }, 0);

  // Calculate total cost (without markup) — exclude services (pure revenue, no cost basis)
  const totalCost = selectedProducts.reduce((sum, p) => {
    if (p.itemType === "service") return sum;
    return sum + (p.unitPrice || 0) * p.quantity;
  }, 0);

  return (
    <tfoot className="bg-muted/50">
      {/* Cost row (without markup) - VISIBLE AGAIN with clear label */}
      <tr className="no-pdf-export border-t bg-muted/20">
        <td
          colSpan={2}
          className="p-3 text-right text-muted-foreground whitespace-nowrap text-sm"
        >
          Custo dos Produtos (Bruto):
        </td>
        <td className="p-3 text-right font-medium text-muted-foreground whitespace-nowrap text-sm">
          R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>

      {/* Profit row - only visible in UI, not PDF */}
      {totalProfit > 0 && (
        <tr className="no-pdf-export">
          <td
            colSpan={2}
            className="p-3 text-right text-green-600 dark:text-green-400 whitespace-nowrap text-sm"
          >
            Lucro (Markup):
          </td>
          <td className="p-3 text-right font-medium text-green-600 dark:text-green-400 whitespace-nowrap text-sm">
            R$ {totalProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      )}

      <tr className="border-t">
        <td
          colSpan={2}
          className="p-3 text-right whitespace-nowrap font-medium"
        >
          Subtotal (Preço de Venda):
        </td>
        <td className="p-3 text-right font-bold whitespace-nowrap text-lg">
          R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>

      {discountPercentage > 0 && (
        <tr>
          <td
            colSpan={2}
            className="p-3 text-right text-destructive whitespace-nowrap"
          >
            Desconto ({discountPercentage}%):
          </td>
          <td className="p-3 text-right font-medium text-destructive whitespace-nowrap">
            - R$ {discount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      )}

      {/* Extra Expense row - only visible in UI, not PDF */}
      {extraExpense > 0 && (
        <tr className="no-pdf-export">
          <td
            colSpan={2}
            className="p-3 text-right text-orange-600 dark:text-orange-400 whitespace-nowrap text-sm"
          >
            Custos Extras:
          </td>
          <td className="p-3 text-right font-medium text-orange-600 dark:text-orange-400 whitespace-nowrap text-sm">
            + R$ {extraExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      )}

      {/* Valor Combinado row */}
      {(() => {
        const cv = Number(closedValue);
        const rawTotal = subtotal + (extraExpense || 0);
        if (!cv || cv <= 0) return null;
        return (
          <>
            <tr className="border-t">
              <td
                colSpan={2}
                className="p-3 text-right text-purple-700 dark:text-purple-400 whitespace-nowrap font-medium"
              >
                Valor Combinado com o Cliente:
              </td>
              <td className="p-3 text-right font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap">
                R$ {cv.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
            {cv < rawTotal && (
              <tr>
                <td
                  colSpan={2}
                  className="p-3 text-right text-destructive whitespace-nowrap text-sm"
                >
                  Desconto Comercial (Valor Combinado):
                </td>
                <td className="p-3 text-right font-medium text-destructive whitespace-nowrap text-sm">
                  - R$ {(rawTotal - cv).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            )}
          </>
        );
      })()}

      <tr className="border-t-2 border-primary">
        <td
          colSpan={2}
          className="p-3 text-right text-lg font-bold whitespace-nowrap"
        >
          Total:
        </td>
        <td className="p-3 text-right text-lg font-bold text-primary dark:text-white whitespace-nowrap">
          R$ {(Number(closedValue) > 0 ? Number(closedValue) : totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
    </tfoot>
  );
}
