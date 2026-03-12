import { ProposalProduct } from "@/types/proposal";
import { formatCurrency } from "@/utils/format-utils";
import {
  PdfDisplaySettings,
  defaultPdfDisplaySettings,
} from "@/types/pdf-display-settings";

interface PdfTotalsProps {
  products: ProposalProduct[];
  discount: number;
  extraExpense?: number;
  closedValue?: number | null;
  contentStyles: Record<string, React.CSSProperties>;
  // Payment options (optional for backwards compatibility)
  pdfDisplaySettings?: PdfDisplaySettings;
}

/**
 * Renders the totals section in PDF
 */
export function PdfTotals({
  products,
  discount,
  extraExpense,
  closedValue,
  contentStyles,
  pdfDisplaySettings,
}: PdfTotalsProps) {
  const settings = { ...defaultPdfDisplaySettings, ...pdfDisplaySettings };
  const subtotal = products.reduce(
    (sum, p) => (Number(p.quantity || 0) > 0 ? sum + p.total : sum),
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
      </div>
    </div>
  );
}
