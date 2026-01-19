import { ProposalProduct } from "@/types/proposal";
import { formatCurrency } from "@/utils/format-utils";

interface PdfTotalsProps {
  products: ProposalProduct[];
  discount: number;
  extraExpense?: number;
  contentStyles: Record<string, React.CSSProperties>;
  // Payment options (optional for backwards compatibility)
  downPaymentEnabled?: boolean;
  downPaymentValue?: number;
  installmentsEnabled?: boolean;
  installmentsCount?: number;
  installmentValue?: number;
}

/**
 * Renders the totals section in PDF
 */
export function PdfTotals({
  products,
  discount,
  extraExpense,
  contentStyles,
  downPaymentEnabled,
  downPaymentValue,
  installmentsEnabled,
  installmentsCount,
  installmentValue,
}: PdfTotalsProps) {
  const subtotal = products.reduce((sum, p) => sum + p.total, 0);
  const discountAmt = (subtotal * (discount || 0)) / 100;
  const total = subtotal - discountAmt + (extraExpense || 0);

  const hasPaymentOptions =
    (downPaymentEnabled && downPaymentValue && downPaymentValue > 0) ||
    (installmentsEnabled && installmentsCount && installmentsCount >= 1);

  return (
    <div
      className="mt-6 pt-5 border-t-2 flex justify-end"
      style={contentStyles.headerBorder}
    >
      <div className="w-72 grid gap-2 text-right">
        <div
          className="flex items-baseline justify-between"
          style={contentStyles.subtotal}
        >
          <span>Subtotal:</span>
          <span className="font-medium">{formatCurrency(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div
            className="flex items-baseline justify-between"
            style={contentStyles.discount}
          >
            <span>Desconto:</span>
            <span>-{formatCurrency(discountAmt)}</span>
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
          className="flex items-baseline justify-between text-xl font-bold pt-3 border-t"
          style={contentStyles.total}
        >
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
