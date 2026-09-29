import { ProposalProduct } from "@/types/proposal";
import { formatCurrency } from "@/utils/format-utils";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";
import { countsInProposalTotal } from "@/lib/proposal/monthly-lines";

interface PdfTotalsProps {
  products: ProposalProduct[];
  discount: number;
  extraExpense?: number;
  closedValue?: number | null;
  /** Soma das linhas de mensalidade: aparece abaixo do total, por mês. */
  monthlyAmount?: number;
  /** Os itens da mensalidade, pelo nome: com os preços unitários escondidos, é o que diz o que é mensal. */
  monthlyItems?: string[];
  contentStyles: Record<string, React.CSSProperties>;
  // Payment options (optional for backwards compatibility)
  pdfDisplaySettings?: PdfDisplaySettings;
}

/** "A", "A e B", "A, B e C": os itens da mensalidade numa frase. */
export function formatMonthlyItems(names: readonly string[]): string {
  const list = names.map((n) => n.trim()).filter(Boolean);
  if (list.length <= 1) return `Cobrado todo mês: ${list[0] ?? ""}.`;
  return `Cobrados todo mês: ${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}.`;
}

/**
 * Renders the totals section in PDF
 */
export function PdfTotals({
  products,
  discount,
  extraExpense,
  closedValue,
  monthlyAmount,
  monthlyItems = [],
  contentStyles,
  pdfDisplaySettings,
}: PdfTotalsProps) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const subtotal = products.reduce(
    (sum, p) => (Number(p.quantity || 0) > 0 && countsInProposalTotal(p) ? sum + p.total : sum),
    0,
  );
  const discountAmt = (subtotal * (discount || 0)) / 100;
  const calculatedTotal = subtotal - discountAmt + (extraExpense || 0);

  const hasClosedValue = Number(closedValue) > 0;
  
  let total = calculatedTotal;
  let fechamentoDiscount = 0;

  if (hasClosedValue) {
    total = Number(closedValue);
    if (calculatedTotal > Number(closedValue)) {
      fechamentoDiscount = calculatedTotal - Number(closedValue);
    }
  }

  const totalBorderColor =
    (contentStyles.total?.borderTopColor as string) ||
    (contentStyles.headerBorder?.borderColor as string) ||
    "rgba(0, 0, 0, 0.28)";

  return (
    <div
      className="mt-6 pt-5 border-t-2 flex justify-end"
      style={contentStyles.headerBorder}
    >
      <div className="w-72 grid gap-2 text-right">
        {settings.showSubtotals && (
          <div
            className="flex items-baseline justify-between"
            style={contentStyles.subtotal}
          >
            <span>Subtotal:</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
        )}
        {discount > 0 && (
          <div
            className="flex items-baseline justify-between"
            style={contentStyles.discount}
          >
            <span>Desconto:</span>
            <span>-{formatCurrency(discountAmt)}</span>
          </div>
        )}
        {fechamentoDiscount > 0 && (
          <div
            className="flex items-baseline justify-between"
            style={contentStyles.discount}
          >
            <span>Desconto Comercial:</span>
            <span>-{formatCurrency(fechamentoDiscount)}</span>
          </div>
        )}
        {(extraExpense || 0) > 0 && (
          <div
            className="flex items-baseline justify-between"
            style={contentStyles.subtotal}
          >
            <span>Custos Extras:</span>
            <span>+{formatCurrency(extraExpense || 0)}</span>
          </div>
        )}
        <div
          className="flex items-baseline justify-between text-xl font-bold pt-3"
          style={{
            ...contentStyles.total,
            borderTopWidth: "1px",
            borderTopStyle: "solid",
            borderTopColor: totalBorderColor,
          }}
        >
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
        {(monthlyAmount || 0) > 0 && (
          <div
            className="flex items-baseline justify-between"
            style={contentStyles.subtotal}
          >
            <span>Mensalidade:</span>
            <span className="font-medium">+{formatCurrency(monthlyAmount || 0)}/mês</span>
          </div>
        )}
        {(monthlyAmount || 0) > 0 && monthlyItems.length > 0 && (
          <p data-pdf-monthly-items="1" className="text-left text-xs" style={contentStyles.subtotal}>
            {formatMonthlyItems(monthlyItems)}
          </p>
        )}
      </div>
    </div>
  );
}
