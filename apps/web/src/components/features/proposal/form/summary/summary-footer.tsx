import { ProposalProduct } from "@/services/proposal-service";
import { monthlyTotal } from "@/lib/proposal/monthly-lines";
import { proposalProductsCost, proposalProfit } from "@/lib/proposal/profit";
import { useSensitiveData } from "@/hooks/usePermission";

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
  const { canSeeCost } = useSensitiveData();
  // Custo e lucro são da venda: a mensalidade fica fora, como do total.
  const monthly = monthlyTotal(selectedProducts);

  // Lucro do fechamento: serviço entra inteiro, desconto e valor combinado
  // reduzem, custo extra é repassado ao cliente.
  const totalProfit = proposalProfit({
    lines: selectedProducts,
    finalTotal: Number(closedValue) > 0 ? Number(closedValue) : totalValue,
    extraExpense,
  });
  const totalCost = proposalProductsCost(selectedProducts);

  return (
    <tfoot className="bg-muted/50">
      {/* Custo e lucro: só para quem vê o custo (catálogo de permissões). */}
      {canSeeCost && (
      <tr className="no-pdf-export border-t bg-muted/20">
        <td
          colSpan={2}
          className="p-2 sm:p-3 text-right text-muted-foreground whitespace-nowrap max-sm:whitespace-normal text-sm"
        >
          Custo dos Produtos (Bruto):
        </td>
        <td className="p-2 sm:p-3 text-right font-medium text-muted-foreground whitespace-nowrap text-xs sm:text-sm">
          R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>
      )}

      {/* Profit row - only visible in UI, not PDF */}
      {canSeeCost && totalProfit > 0 && (
        <tr className="no-pdf-export">
          <td
            colSpan={2}
            className="p-2 sm:p-3 text-right text-green-600 dark:text-green-400 whitespace-nowrap max-sm:whitespace-normal text-sm"
          >
            Lucro:
          </td>
          <td className="p-2 sm:p-3 text-right font-medium text-green-600 dark:text-green-400 whitespace-nowrap text-xs sm:text-sm">
            R$ {totalProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      )}

      <tr className="border-t">
        <td
          colSpan={2}
          className="p-2 sm:p-3 text-right whitespace-nowrap max-sm:whitespace-normal font-medium"
        >
          Subtotal (Preço de Venda):
        </td>
        <td className="p-2 sm:p-3 text-right font-bold whitespace-nowrap text-sm sm:text-lg">
          R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>

      {discountPercentage > 0 && (
        <tr>
          <td
            colSpan={2}
            className="p-2 sm:p-3 text-right text-destructive whitespace-nowrap max-sm:whitespace-normal"
          >
            Desconto ({discountPercentage}%):
          </td>
          <td className="p-2 sm:p-3 text-right font-medium text-destructive whitespace-nowrap text-xs sm:text-sm">
            - R$ {discount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      )}

      {/* Extra Expense row - only visible in UI, not PDF */}
      {extraExpense > 0 && (
        <tr className="no-pdf-export">
          <td
            colSpan={2}
            className="p-2 sm:p-3 text-right text-orange-600 dark:text-orange-400 whitespace-nowrap max-sm:whitespace-normal text-sm"
          >
            Custos Extras:
          </td>
          <td className="p-2 sm:p-3 text-right font-medium text-orange-600 dark:text-orange-400 whitespace-nowrap text-xs sm:text-sm">
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
                className="p-2 sm:p-3 text-right text-purple-700 dark:text-purple-400 whitespace-nowrap max-sm:whitespace-normal font-medium"
              >
                Valor Combinado com o Cliente:
              </td>
              <td className="p-2 sm:p-3 text-right font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap text-xs sm:text-sm">
                R$ {cv.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
            {cv < rawTotal && (
              <tr>
                <td
                  colSpan={2}
                  className="p-2 sm:p-3 text-right text-destructive whitespace-nowrap max-sm:whitespace-normal text-sm"
                >
                  Desconto Comercial (Valor Combinado):
                </td>
                <td className="p-2 sm:p-3 text-right font-medium text-destructive whitespace-nowrap text-xs sm:text-sm">
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
          className="p-2 sm:p-3 text-right text-sm sm:text-lg font-bold whitespace-nowrap max-sm:whitespace-normal"
        >
          Total:
        </td>
        <td className="p-2 sm:p-3 text-right text-sm sm:text-lg font-bold text-primary dark:text-white whitespace-nowrap">
          R$ {(Number(closedValue) > 0 ? Number(closedValue) : totalValue).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      </tr>

      {monthly > 0 && (
        <tr>
          <td
            colSpan={2}
            className="p-2 sm:p-3 text-right text-violet-700 dark:text-violet-300 whitespace-nowrap max-sm:whitespace-normal font-medium"
          >
            Mensalidade (contrato, fora do total):
          </td>
          <td className="p-2 sm:p-3 text-right font-bold text-violet-700 dark:text-violet-300 whitespace-nowrap text-xs sm:text-sm">
            + R$ {monthly.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês
          </td>
        </tr>
      )}
    </tfoot>
  );
}
