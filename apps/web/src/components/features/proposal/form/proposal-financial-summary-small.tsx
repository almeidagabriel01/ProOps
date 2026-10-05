import { ProposalProduct } from "@/services/proposal-service";
import { proposalLinesProfit, proposalSaleValue } from "@/lib/proposal/profit";

interface ProposalFinancialSummarySmallProps {
  selectedProducts: ProposalProduct[];
  className?: string;
}

export function ProposalFinancialSummarySmall({
  selectedProducts,
  className,
}: ProposalFinancialSummarySmallProps) {
  // A mensalidade vira contrato: fora do valor e do lucro da venda. O serviço
  // entra inteiro no lucro; o desconto só existe no passo de pagamento.
  const totalValue = proposalSaleValue(selectedProducts);
  const totalProfit = proposalLinesProfit(selectedProducts);

  return (
    <div
      className={`flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Total:</span>
        <span className="font-semibold">R$ {totalValue.toFixed(2)}</span>
      </div>
      <div className="hidden w-px h-4 bg-border sm:block" />
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Lucro:</span>
        <span className="font-semibold text-green-600 dark:text-green-400">
          R$ {totalProfit.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
